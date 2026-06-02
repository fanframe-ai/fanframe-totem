# Foreground Person Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar que pessoas no fundo da foto sejam enviadas para a IA, mantendo apenas 1 ou 2 pessoas principais no primeiro plano.

**Architecture:** A validacao e o recorte rodam no app Windows antes de chamar `generate-tryon`, para nao gastar pagamento/IA com foto ruim. O backend continua recebendo `userImageBase64`, mas esse payload passa a ser uma imagem preprocessada com somente as pessoas aprovadas em primeiro plano.

**Tech Stack:** React/Vite/Electron, Canvas API, MediaPipe/TensorFlow.js para segmentacao/deteccao local, Vitest para testes unitarios, Supabase Edge Functions para geracao final.

---

## Decisao tecnica

Implementar em duas fases:

1. **MVP confiavel:** detectar pessoas principais por segmentacao local, calcular bounding boxes, aceitar no maximo 2 pessoas grandes/centrais e bloquear quando houver excesso de pessoas relevantes.
2. **Evolucao:** aplicar mascara/recorte suave para remover pessoas de fundo antes da geracao.

Recomendacao inicial: usar `@tensorflow-models/body-pix` ou `@tensorflow-models/body-segmentation` com BodyPix, porque BodyPix tem suporte a multiplas pessoas. MediaPipe Selfie Segmentation e bom para separar pessoa/fundo, mas nao diferencia bem cada pessoa individualmente; isso dificulta separar quem esta no primeiro plano de quem esta atras.

## Comportamento esperado

- Se houver 1 pessoa principal: prosseguir.
- Se houver 2 pessoas principais lado a lado: prosseguir.
- Se houver pessoas pequenas no fundo: ignorar/remover.
- Se houver 3 ou mais pessoas grandes/centrais: bloquear antes da IA.
- Se a pessoa principal estiver pequena/longe: pedir para chegar mais perto.
- Se nao detectar pessoa: pedir para refazer a foto.

## Arquivos

- Create: `src/lib/personForeground/personTypes.ts`
  - Tipos puros: `DetectedPerson`, `ForegroundDecision`, `ForegroundFilterConfig`.

- Create: `src/lib/personForeground/personScoring.ts`
  - Logica pura para classificar pessoas por area, centralidade e relevancia.

- Create: `src/lib/personForeground/personScoring.test.ts`
  - Testes sem camera/modelo para validar regras de 1 pessoa, 2 pessoas e excesso de pessoas.

- Create: `src/lib/personForeground/personCanvas.ts`
  - Utilitarios de Canvas para aplicar mascara/recorte e gerar novo `dataUrl`.

- Create: `src/lib/personForeground/personDetector.ts`
  - Adaptador do modelo ML. Responsavel por carregar modelo, detectar pessoas e retornar bounding boxes/masks normalizados.

- Create: `src/lib/personForeground/processForegroundPhoto.ts`
  - Orquestrador usado pelo kiosk: recebe `dataUrl`, aplica deteccao, toma decisao e devolve `{ ok, processedImage, message }`.

- Modify: `src/pages/Kiosk.tsx`
  - Inserir etapa de validacao em `startGeneration`, antes de chamar `supabase.functions.invoke("generate-tryon")`.
  - Exibir mensagem simples na tela de camera quando a foto precisar ser refeita.

- Modify: `src/shared/kiosk-ui/KioskVisual.tsx`
  - Adicionar estado visual opcional para "Analisando foto..." e erro de foto.

- Modify: `src/shared/kiosk-ui/kioskVisual.css`
  - Estilizar aviso de foto com pouco peso visual.

- Modify: `apps/admin/src/App.tsx`
  - Adicionar configuracoes por time:
    - ativar/desativar filtro de primeiro plano;
    - maximo de pessoas: padrao 2;
    - tolerancia de pessoas pequenas ao fundo;
    - texto exibido quando a foto precisa ser refeita.

- Modify: Supabase schema/migration
  - Adicionar colunas em `teams`:
    - `kiosk_foreground_filter_enabled boolean default true`
    - `kiosk_max_foreground_people integer default 2`
    - `kiosk_foreground_min_area_ratio numeric default 0.08`
    - `kiosk_foreground_warning_text text`

- Modify: `supabase/functions/generate-tryon/index.ts`
  - Aceitar metadados opcionais:
    - `foregroundFilterApplied`
    - `foregroundPeopleCount`
  - Salvar logs na fila para auditoria.

---

## Task 1: Criar regras puras de selecao de pessoas

- [ ] **Step 1: Criar tipos**

Criar `src/lib/personForeground/personTypes.ts`:

```ts
export type DetectedPerson = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  mask?: ImageData;
};

export type ForegroundFilterConfig = {
  enabled: boolean;
  maxPeople: number;
  minAreaRatio: number;
  centerWeight: number;
};

export type ForegroundDecision =
  | {
      ok: true;
      selectedPeople: DetectedPerson[];
      ignoredPeople: DetectedPerson[];
      reason: "valid";
    }
  | {
      ok: false;
      selectedPeople: DetectedPerson[];
      ignoredPeople: DetectedPerson[];
      reason: "no_person" | "too_many_people" | "too_far";
      message: string;
    };
```

- [ ] **Step 2: Criar teste de regras**

Criar `src/lib/personForeground/personScoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseForegroundPeople } from "./personScoring";
import type { DetectedPerson } from "./personTypes";

const person = (id: string, x: number, y: number, width: number, height: number): DetectedPerson => ({
  id,
  x,
  y,
  width,
  height,
  imageWidth: 1000,
  imageHeight: 1500,
  confidence: 0.9,
});

const config = {
  enabled: true,
  maxPeople: 2,
  minAreaRatio: 0.08,
  centerWeight: 0.35,
};

describe("chooseForegroundPeople", () => {
  it("accepts one large centered person", () => {
    const result = chooseForegroundPeople([person("main", 300, 250, 400, 900)], config);
    expect(result.ok).toBe(true);
    expect(result.selectedPeople.map((item) => item.id)).toEqual(["main"]);
  });

  it("accepts two large foreground people and ignores a small background person", () => {
    const result = chooseForegroundPeople([
      person("left", 120, 300, 350, 850),
      person("right", 520, 300, 350, 850),
      person("background", 770, 200, 80, 200),
    ], config);
    expect(result.ok).toBe(true);
    expect(result.selectedPeople.map((item) => item.id)).toEqual(["left", "right"]);
    expect(result.ignoredPeople.map((item) => item.id)).toEqual(["background"]);
  });

  it("blocks when three relevant foreground people are present", () => {
    const result = chooseForegroundPeople([
      person("a", 60, 350, 280, 780),
      person("b", 360, 350, 280, 780),
      person("c", 660, 350, 280, 780),
    ], config);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_many_people");
  });

  it("blocks when all people are too small", () => {
    const result = chooseForegroundPeople([person("far", 420, 400, 100, 220)], config);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_far");
  });
});
```

- [ ] **Step 3: Rodar teste e confirmar falha**

Run:

```bash
npm run test -- src/lib/personForeground/personScoring.test.ts
```

Expected: falha porque `personScoring.ts` ainda nao existe.

- [ ] **Step 4: Implementar scoring**

Criar `src/lib/personForeground/personScoring.ts`:

```ts
import type { DetectedPerson, ForegroundDecision, ForegroundFilterConfig } from "./personTypes";

const areaRatio = (person: DetectedPerson) =>
  (person.width * person.height) / (person.imageWidth * person.imageHeight);

const centerDistance = (person: DetectedPerson) => {
  const personCenterX = person.x + person.width / 2;
  const imageCenterX = person.imageWidth / 2;
  return Math.abs(personCenterX - imageCenterX) / imageCenterX;
};

const scorePerson = (person: DetectedPerson, config: ForegroundFilterConfig) => {
  const areaScore = areaRatio(person);
  const centerScore = Math.max(0, 1 - centerDistance(person)) * config.centerWeight;
  return areaScore + centerScore;
};

export const chooseForegroundPeople = (
  people: DetectedPerson[],
  config: ForegroundFilterConfig,
): ForegroundDecision => {
  if (!people.length) {
    return {
      ok: false,
      selectedPeople: [],
      ignoredPeople: [],
      reason: "no_person",
      message: "Nao encontramos uma pessoa na foto. Tente novamente.",
    };
  }

  const relevantPeople = people.filter((person) => areaRatio(person) >= config.minAreaRatio);
  const ignoredPeople = people.filter((person) => areaRatio(person) < config.minAreaRatio);

  if (!relevantPeople.length) {
    return {
      ok: false,
      selectedPeople: [],
      ignoredPeople,
      reason: "too_far",
      message: "Chegue mais perto da camera e tire outra foto.",
    };
  }

  const sorted = [...relevantPeople].sort((a, b) => scorePerson(b, config) - scorePerson(a, config));
  const selectedPeople = sorted.slice(0, config.maxPeople);

  if (relevantPeople.length > config.maxPeople) {
    return {
      ok: false,
      selectedPeople,
      ignoredPeople,
      reason: "too_many_people",
      message: `Use no maximo ${config.maxPeople} pessoas na foto.`,
    };
  }

  return {
    ok: true,
    selectedPeople,
    ignoredPeople,
    reason: "valid",
  };
};
```

- [ ] **Step 5: Rodar teste e confirmar sucesso**

Run:

```bash
npm run test -- src/lib/personForeground/personScoring.test.ts
```

Expected: PASS.

---

## Task 2: Criar detector local no kiosk

- [ ] **Step 1: Instalar dependencia**

Run:

```bash
npm install @tensorflow/tfjs @tensorflow-models/body-pix
```

- [ ] **Step 2: Criar adaptador do modelo**

Criar `src/lib/personForeground/personDetector.ts`:

```ts
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs";
import type { DetectedPerson } from "./personTypes";

let modelPromise: Promise<bodyPix.BodyPix> | null = null;

const loadModel = () => {
  if (!modelPromise) {
    modelPromise = bodyPix.load({
      architecture: "MobileNetV1",
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    });
  }
  return modelPromise;
};

export const detectPeopleFromImage = async (image: HTMLImageElement): Promise<DetectedPerson[]> => {
  const model = await loadModel();
  const segmentation = await model.segmentMultiPerson(image, {
    internalResolution: "medium",
    segmentationThreshold: 0.7,
    maxDetections: 5,
    scoreThreshold: 0.2,
  });

  return segmentation.map((item, index) => ({
    id: `person-${index + 1}`,
    x: item.boundingBox.minX,
    y: item.boundingBox.minY,
    width: item.boundingBox.maxX - item.boundingBox.minX,
    height: item.boundingBox.maxY - item.boundingBox.minY,
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    confidence: item.score,
    mask: item.mask,
  }));
};
```

- [ ] **Step 3: Criar utilitario de carregamento de imagem**

Criar `src/lib/personForeground/processForegroundPhoto.ts` com loader inicial:

```ts
export const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel analisar a foto."));
    image.src = dataUrl;
  });
```

---

## Task 3: Aplicar decisao antes de chamar a IA

- [ ] **Step 1: Criar orquestrador**

Atualizar `src/lib/personForeground/processForegroundPhoto.ts`:

```ts
import { chooseForegroundPeople } from "./personScoring";
import { detectPeopleFromImage } from "./personDetector";
import type { ForegroundFilterConfig } from "./personTypes";

export const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel analisar a foto."));
    image.src = dataUrl;
  });

export const processForegroundPhoto = async (dataUrl: string, config: ForegroundFilterConfig) => {
  if (!config.enabled) {
    return {
      ok: true as const,
      processedImage: dataUrl,
      peopleCount: null,
      filterApplied: false,
    };
  }

  const image = await loadImageFromDataUrl(dataUrl);
  const people = await detectPeopleFromImage(image);
  const decision = chooseForegroundPeople(people, config);

  if (!decision.ok) {
    return {
      ok: false as const,
      message: decision.message,
      reason: decision.reason,
      peopleCount: people.length,
      filterApplied: true,
    };
  }

  return {
    ok: true as const,
    processedImage: dataUrl,
    peopleCount: decision.selectedPeople.length,
    filterApplied: true,
  };
};
```

- [ ] **Step 2: Integrar no `startGeneration`**

Modificar `src/pages/Kiosk.tsx`:

```ts
import { processForegroundPhoto } from "@/lib/personForeground/processForegroundPhoto";
```

Dentro de `startGeneration`, antes de `supabase.functions.invoke("generate-tryon")`:

```ts
const foregroundResult = await processForegroundPhoto(userImage, {
  enabled: team.kiosk_foreground_filter_enabled !== false,
  maxPeople: Number(team.kiosk_max_foreground_people ?? 2),
  minAreaRatio: Number(team.kiosk_foreground_min_area_ratio ?? 0.08),
  centerWeight: 0.35,
});

if (!foregroundResult.ok) {
  setError(foregroundResult.message);
  setStep("camera");
  return;
}
```

Alterar o body enviado para usar a foto processada:

```ts
userImageBase64: foregroundResult.processedImage,
foregroundFilterApplied: foregroundResult.filterApplied,
foregroundPeopleCount: foregroundResult.peopleCount,
```

- [ ] **Step 3: Validar manualmente**

Run:

```bash
npm run build
```

Expected: build passa.

---

## Task 4: Adicionar mascara/recorte real para remover fundo

- [ ] **Step 1: Criar canvas compositor**

Criar `src/lib/personForeground/personCanvas.ts`:

```ts
import type { DetectedPerson } from "./personTypes";

export const renderForegroundOnlyImage = (image: HTMLImageElement, selectedPeople: DetectedPerson[]) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas indisponivel para preparar a foto.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  // MVP: recorta apenas o retangulo combinado das pessoas selecionadas.
  // Evolucao: usar pixel mask do BodyPix para manter somente silhuetas.
  const left = Math.max(0, Math.min(...selectedPeople.map((person) => person.x)) - 40);
  const top = Math.max(0, Math.min(...selectedPeople.map((person) => person.y)) - 40);
  const right = Math.min(canvas.width, Math.max(...selectedPeople.map((person) => person.x + person.width)) + 40);
  const bottom = Math.min(canvas.height, Math.max(...selectedPeople.map((person) => person.y + person.height)) + 40);

  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const outputCtx = output.getContext("2d");

  if (!outputCtx) {
    throw new Error("Canvas indisponivel para preparar a foto.");
  }

  outputCtx.fillStyle = "#ffffff";
  outputCtx.fillRect(0, 0, output.width, output.height);
  outputCtx.drawImage(canvas, left, top, right - left, bottom - top, left, top, right - left, bottom - top);

  return output.toDataURL("image/png", 0.95);
};
```

- [ ] **Step 2: Usar compositor no orquestrador**

Atualizar `processForegroundPhoto.ts`:

```ts
import { renderForegroundOnlyImage } from "./personCanvas";
```

No retorno `ok`:

```ts
const processedImage = renderForegroundOnlyImage(image, decision.selectedPeople);

return {
  ok: true as const,
  processedImage,
  peopleCount: decision.selectedPeople.length,
  filterApplied: true,
};
```

---

## Task 5: UX na tela de camera

- [ ] **Step 1: Adicionar estado de analise**

Modificar `src/pages/Kiosk.tsx`:

```ts
const [photoValidationBusy, setPhotoValidationBusy] = useState(false);
const [photoValidationMessage, setPhotoValidationMessage] = useState<string | null>(null);
```

Antes de processar:

```ts
setPhotoValidationBusy(true);
setPhotoValidationMessage(null);
```

Ao bloquear:

```ts
setPhotoValidationMessage(foregroundResult.message);
setPhotoValidationBusy(false);
setStep("camera");
return;
```

No `finally` do processamento:

```ts
setPhotoValidationBusy(false);
```

- [ ] **Step 2: Passar props para visual**

Modificar chamada de `KioskCameraVisual` em `src/pages/Kiosk.tsx`:

```tsx
validationBusy={photoValidationBusy}
validationMessage={photoValidationMessage}
```

- [ ] **Step 3: Atualizar componente visual**

Modificar `src/shared/kiosk-ui/KioskVisual.tsx` em `KioskCameraVisualProps`:

```ts
validationBusy?: boolean;
validationMessage?: string | null;
```

Renderizar abaixo da foto:

```tsx
{validationBusy && <p className="ff-kiosk-camera-note">Analisando foto...</p>}
{validationMessage && <p className="ff-kiosk-camera-warning">{validationMessage}</p>}
```

- [ ] **Step 4: Estilizar aviso**

Modificar `src/shared/kiosk-ui/kioskVisual.css`:

```css
.ff-kiosk-camera-note,
.ff-kiosk-camera-warning {
  margin: 18px 0 0;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
}

.ff-kiosk-camera-note {
  color: rgba(255, 255, 255, 0.72);
}

.ff-kiosk-camera-warning {
  color: #f6d36f;
}
```

---

## Task 6: Configuracao no painel admin

- [ ] **Step 1: Criar migration**

Criar migration Supabase:

```sql
alter table public.teams
  add column if not exists kiosk_foreground_filter_enabled boolean not null default true,
  add column if not exists kiosk_max_foreground_people integer not null default 2,
  add column if not exists kiosk_foreground_min_area_ratio numeric not null default 0.08,
  add column if not exists kiosk_foreground_warning_text text;
```

- [ ] **Step 2: Adicionar controles no painel**

Modificar `apps/admin/src/App.tsx`, na area do construtor/time:

- Toggle: `Evitar pessoas no fundo`
- Select: `Quantidade maxima na foto` com opcoes `1` e `2`
- Slider/input: `Sensibilidade para ignorar fundo`, salvando `kiosk_foreground_min_area_ratio`
- Texto: `Mensagem quando precisar refazer a foto`

- [ ] **Step 3: Garantir publish**

Atualizar merge/publish do time para preservar os novos campos ao alterar preco, textos ou assets.

Run:

```bash
npm run test -- apps/admin/src/lib/kioskDraft.test.ts src/lib/adminBuilderArchitecture.test.ts
```

Expected: PASS.

---

## Task 7: Backend e logs

- [ ] **Step 1: Aceitar metadados na Edge Function**

Modificar `supabase/functions/generate-tryon/index.ts`, no parse do body:

```ts
foregroundFilterApplied,
foregroundPeopleCount,
```

Adicionar ao log/insercao de fila:

```ts
foreground_filter_applied: Boolean(foregroundFilterApplied),
foreground_people_count: typeof foregroundPeopleCount === "number" ? foregroundPeopleCount : null,
```

- [ ] **Step 2: Migration opcional de auditoria**

Se a tabela `generation_queue` ainda nao tiver JSON livre, adicionar:

```sql
alter table public.generation_queue
  add column if not exists foreground_filter_applied boolean,
  add column if not exists foreground_people_count integer;
```

---

## Task 8: Testes finais

- [ ] **Step 1: Testes unitarios**

Run:

```bash
npm run test -- src/lib/personForeground/personScoring.test.ts src/lib/adminBuilderArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 2: Build app e admin**

Run:

```bash
npm run lint
npm run build
npm --prefix apps/admin run build
```

Expected: todos passam.

- [ ] **Step 3: Teste manual no Windows**

Cenarios:

1. Foto com 1 pessoa perto: deve gerar.
2. Foto com 2 pessoas perto: deve gerar.
3. Foto com 1 pessoa perto e pessoas pequenas atras: deve gerar ignorando o fundo.
4. Foto com 3 pessoas perto: deve bloquear antes da IA.
5. Foto sem pessoa: deve bloquear antes da IA.
6. Foto com pessoa muito longe: deve pedir para chegar mais perto.

- [ ] **Step 4: Gerar release Windows**

Run:

```bash
npm version 0.3.9 --no-git-tag-version
npm run dist:win
```

Publicar release GitHub com:

- `release/FanFrame Kiosk Setup 0.3.9.exe`
- `release/FanFrame Kiosk Setup 0.3.9.exe.blockmap`
- `release/FanFrame Kiosk 0.3.9.exe`
- `release/FanFrame-Kiosk-Setup-latest.exe`
- `release/latest.yml`

---

## Riscos e limites

- Segmentacao local aumenta o tamanho do app e pode consumir mais CPU no PC do totem.
- BodyPix funciona bem para multiplas pessoas, mas nao e perfeito em luz ruim.
- Se a foto tiver reflexos, sombras ou pessoas muito proximas no fundo, pode exigir ajuste fino de `minAreaRatio`.
- O primeiro MVP deve bloquear casos ruins antes da IA; a remocao perfeita de fundo pode ficar para a segunda iteracao.

## Criterio de pronto

- O app nao envia para IA fotos com mais de 2 pessoas relevantes.
- Pessoas pequenas ao fundo nao bloqueiam a foto.
- O usuario recebe uma mensagem simples para refazer quando necessario.
- O admin consegue ligar/desligar e ajustar a sensibilidade por time.
- `npm run lint`, `npm run build`, `npm --prefix apps/admin run build` e testes especificos passam.
