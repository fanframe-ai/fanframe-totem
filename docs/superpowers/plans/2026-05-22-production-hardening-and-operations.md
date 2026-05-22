# FanFrame Totem Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o FanFrame Totem mais simples de operar em vários pontos físicos, com atualização remota, QR mobile melhor, assets controlados, monitoramento prático, segurança revisada e documentação para o dono do totem.

**Architecture:** O app Electron continua sendo o cliente local do totem, o painel em `apps/admin` continua sendo o centro remoto de operação, e Supabase Edge Functions/RPCs concentram ações sensíveis. O plano evita criar sistemas paralelos: reaproveita `kiosk_devices`, `kiosk_device_events`, `kiosk_device_commands`, `consent_logs`, `teams.tutorial_assets` e os fluxos já existentes.

**Tech Stack:** React/Vite, Electron, Supabase Postgres/Storage/Edge Functions, Vercel, TypeScript, ESLint, Vitest.

---

## File Structure

- Modify: `electron/main.cjs` - baixar e iniciar instalador remoto com mais feedback e modo silencioso quando possível.
- Modify: `electron/kiosk-updates.cjs` - normalizar descoberta de atualização local/remota e mensagens amigáveis.
- Modify: `electron/kiosk-updates.test.ts` - cobrir atualização por URL, Downloads e erro de configuração.
- Modify: `src/pages/Kiosk.tsx` - melhorar mensagens do modo técnico sobre atualização e sincronização.
- Modify: `apps/admin/src/App.tsx` - adicionar campos de update por totem, página mobile do QR mais configurável, galeria de fotos autorizadas e alertas mais claros.
- Modify: `apps/admin/src/lib/operationalHealth.ts` - centralizar regras de alerta operacional.
- Modify: `apps/admin/src/lib/operationalHealth.test.ts` - testar alertas por offline, erro, versão e pagamento.
- Modify: `apps/admin/src/lib/types.ts` - tipar novas configs de QR, assets e update.
- Modify: `apps/admin/src/styles.css` - polir telas novas do painel.
- Modify: `supabase/functions/create-delivery-link/index.ts` - página mobile do QR com marca do time, expiração, download, compartilhar e autorização.
- Create: `supabase/migrations/20260522100000_add_kiosk_update_and_asset_controls.sql` - campos de update, limites de asset e views operacionais.
- Create: `docs/totem-owner-quickstart.md` - guia simples para o dono do ponto.
- Modify: `docs/go-live-checklist.md` - checklist final de produção.

---

## Task 1: Atualização Remota Mais Fácil

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/kiosk-updates.cjs`
- Modify: `electron/kiosk-updates.test.ts`
- Modify: `src/pages/Kiosk.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/lib/types.ts`

- [ ] **Step 1: Write failing tests for update readiness**

Add tests in `electron/kiosk-updates.test.ts`:

```ts
it("accepts a remote installer url as an update source", () => {
  const readiness = getUpdateReadiness({
    updates: {
      installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
    },
  });

  expect(readiness.ready).toBe(true);
  expect(readiness.mode).toBe("remote_installer");
  expect(readiness.installerUrl).toContain("FanFrame-Kiosk-Setup.exe");
});

it("prefers a local installer found in Downloads when no url is configured", () => {
  const readiness = getUpdateReadiness(
    { updates: {} },
    { searchDirs: ["D:/Downloads"], fileExists: (path) => path.endsWith("FanFrame Kiosk Setup 0.2.1.exe") },
  );

  expect(readiness.ready).toBe(true);
  expect(readiness.mode).toBe("local_installer");
});

it("returns a clear message when no update source exists", () => {
  const readiness = getUpdateReadiness({ updates: {} }, { searchDirs: [], fileExists: () => false });

  expect(readiness.ready).toBe(false);
  expect(readiness.message).toBe("Nenhum instalador de atualizacao configurado neste PC.");
});
```

- [ ] **Step 2: Run update tests and verify failure**

Run:

```powershell
npm test -- electron/kiosk-updates.test.ts
```

Expected: at least the remote URL test fails if `remote_installer` is not fully supported.

- [ ] **Step 3: Implement update readiness**

In `electron/kiosk-updates.cjs`, make `getUpdateReadiness(config, options)` return:

```js
{
  ready: true,
  mode: "remote_installer",
  installerUrl: config.updates.installerUrl,
  message: "Atualizacao pronta para baixar e instalar.",
}
```

when `config.updates.installerUrl` starts with `https://`.

- [ ] **Step 4: Improve installer execution feedback**

In `electron/main.cjs`, make `startAppUpdate()` return these user-facing statuses:

```js
{ ok: true, status: "downloaded", message: "Instalador baixado. Iniciando atualizacao..." }
{ ok: true, status: "started", message: "Atualizacao iniciada. O app sera fechado." }
{ ok: false, status: "download_failed", message: "Nao foi possivel baixar a atualizacao. Verifique a internet." }
```

- [ ] **Step 5: Add admin fields per device**

In `apps/admin/src/App.tsx`, inside device detail, add simple fields:

- `Link do instalador`
- `Versao desejada`
- `Canal de atualizacao`

Store them in existing `kiosk_devices.expected_app_version`, `kiosk_devices.update_channel` and `kiosk_devices.config.updateInstallerUrl`.

- [ ] **Step 6: Test update flow**

Run:

```powershell
npm test -- electron/kiosk-updates.test.ts
npm run lint
npm run build
npm run admin:build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add electron/main.cjs electron/kiosk-updates.cjs electron/kiosk-updates.test.ts src/pages/Kiosk.tsx apps/admin/src/App.tsx apps/admin/src/lib/types.ts
git commit -m "Improve kiosk remote update flow"
```

---

## Task 2: Página Mobile Do QR Mais Profissional

**Files:**
- Modify: `supabase/functions/create-delivery-link/index.ts`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/lib/types.ts`

- [ ] **Step 1: Add delivery page config types**

In `apps/admin/src/lib/types.ts`, extend `TeamTutorialAssets`:

```ts
deliveryLogo?: string;
deliveryMessage?: string;
deliveryWhatsApp?: string;
deliveryInstagram?: string;
```

- [ ] **Step 2: Add admin controls**

In `apps/admin/src/App.tsx`, in the `Experiencia` tab, add fields:

- `Logo da pagina de download`
- `Mensagem da pagina de download`
- `WhatsApp de suporte`
- `Instagram`

Persist them in `team.tutorial_assets`.

- [ ] **Step 3: Fetch team branding in delivery function**

In `supabase/functions/create-delivery-link/index.ts`, change the GET query to include team data:

```ts
.select("*, teams(name, logo_url, tutorial_assets)")
```

Use `link.teams?.logo_url`, `tutorial_assets.deliveryLogo`, and `tutorial_assets.deliveryMessage` in the HTML.

- [ ] **Step 4: Add expiration display**

In the mobile HTML, show:

```html
<small>Link valido ate ${formattedExpiration}</small>
```

where `formattedExpiration` is generated server-side with `new Date(link.expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })`.

- [ ] **Step 5: Add manual test**

Create a real kiosk session, scan the QR, and verify:

- image preview loads;
- download button downloads;
- share button opens native share or copies link;
- authorization button registers consent;
- page shows team branding.

- [ ] **Step 6: Deploy and commit**

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token local>'
npx supabase functions deploy create-delivery-link --project-ref dzfbjscrpxhpyeimggut
git add supabase/functions/create-delivery-link/index.ts apps/admin/src/App.tsx apps/admin/src/lib/types.ts
git commit -m "Improve mobile delivery page"
```

---

## Task 3: Controle De Vídeos E Assets Pesados

**Files:**
- Create: `supabase/migrations/20260522100000_add_kiosk_update_and_asset_controls.sql`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/styles.css`

- [ ] **Step 1: Add asset guidance constants**

In `apps/admin/src/App.tsx`, add:

```ts
const assetLimits = {
  imageMaxMb: 8,
  videoMaxMb: 80,
  videoRecommendedSeconds: 30,
  videoRecommendedRatio: "9:16",
};
```

- [ ] **Step 2: Validate upload size before Supabase upload**

Before calling `uploadAsset(file, path)`, validate:

```ts
function validateExperienceFile(file: File, kind: "image" | "video") {
  const limitMb = kind === "video" ? assetLimits.videoMaxMb : assetLimits.imageMaxMb;
  const sizeMb = file.size / 1024 / 1024;
  if (sizeMb > limitMb) {
    throw new Error(`Arquivo muito pesado. Limite: ${limitMb} MB.`);
  }
}
```

- [ ] **Step 3: Show clear UI guidance**

In the `Experiencia` tab, show:

```text
Video recomendado: MP4 vertical 9:16, ate 30 segundos, ate 80 MB, sem audio importante.
Imagens recomendadas: JPG/PNG vertical, ate 8 MB.
```

- [ ] **Step 4: Add migration comments for Storage policy review**

Create `supabase/migrations/20260522100000_add_kiosk_update_and_asset_controls.sql` with:

```sql
COMMENT ON TABLE storage.objects IS
'FanFrame: revisar limites de upload do bucket tryon-assets para imagens e videos do totem antes do go-live.';
```

- [ ] **Step 5: Test**

Try uploading:

- valid image under 8 MB;
- image over 8 MB;
- video under 80 MB;
- video over 80 MB.

Expected: invalid files are blocked before upload with simple message.

- [ ] **Step 6: Commit**

```powershell
git add apps/admin/src/App.tsx apps/admin/src/styles.css supabase/migrations/20260522100000_add_kiosk_update_and_asset_controls.sql
git commit -m "Add kiosk asset upload guardrails"
```

---

## Task 4: Monitoramento Operacional Mais Prático

**Files:**
- Modify: `apps/admin/src/lib/operationalHealth.ts`
- Modify: `apps/admin/src/lib/operationalHealth.test.ts`
- Modify: `apps/admin/src/App.tsx`

- [ ] **Step 1: Add operational issue tests**

In `apps/admin/src/lib/operationalHealth.test.ts`, add tests for:

```ts
it("flags a device offline after 5 minutes without contact", () => {});
it("flags a device with payment errors as urgent", () => {});
it("flags a device running an old app version", () => {});
it("does not flag a healthy online device", () => {});
```

- [ ] **Step 2: Implement issue severity**

In `apps/admin/src/lib/operationalHealth.ts`, normalize severities:

```ts
type OperationalSeverity = "ok" | "warning" | "danger";
```

Rules:

- `danger`: offline over 15 minutes, payment unavailable, repeated IA errors;
- `warning`: offline over 5 minutes, old app version, no PIN, no install;
- `ok`: online, no last error, version current.

- [ ] **Step 3: Add dashboard cards**

In `apps/admin/src/App.tsx`, add dashboard cards:

- `Totens sem contato`
- `Pagamentos com erro`
- `IA com falha`
- `Precisam atualizar`

Each card links to `/problemas`.

- [ ] **Step 4: Add Problems priority list**

In `ProblemsPage`, group issues by severity:

```text
Resolver agora
Verificar hoje
Informativo
```

- [ ] **Step 5: Test**

Run:

```powershell
npm --prefix apps/admin test -- src/lib/operationalHealth.test.ts
npm run admin:build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/admin/src/lib/operationalHealth.ts apps/admin/src/lib/operationalHealth.test.ts apps/admin/src/App.tsx
git commit -m "Improve operational monitoring alerts"
```

---

## Task 5: Segurança Final Antes De Produção

**Files:**
- Modify: `supabase/functions/create-delivery-link/index.ts`
- Modify: `supabase/functions/create-kiosk-payment/index.ts`
- Modify: `src/integrations/supabase/types.ts`
- Create: `docs/security-production-review.md`

- [ ] **Step 1: Audit frontend secrets**

Run:

```powershell
rg -n "replicate|pagbank|service_role|sb_secret|token|password|secret|8a9a|32c685|r8_" src apps/admin electron supabase/functions docs -S
```

Expected: no production secrets in frontend files, docs or committed code.

- [ ] **Step 2: Harden delivery function POST**

In `create-delivery-link`, keep POST action limited to:

```ts
if (body?.action !== "share_consent") {
  return jsonResponse({ error: "Unsupported action" }, 400);
}
```

and do not expose raw database errors to the client. Log raw errors server-side only.

- [ ] **Step 3: Confirm PagBank token is env-only**

In `create-kiosk-payment`, verify token comes only from:

```ts
Deno.env.get("PAGBANK_TOKEN")
```

and never from request body.

- [ ] **Step 4: Create security review doc**

Create `docs/security-production-review.md` with sections:

```md
# Security Production Review

## Secrets
- PagBank token: Supabase Edge Function environment only.
- Replicate token: Supabase Edge Function environment only.
- Supabase service role: Edge Functions only.

## Public Frontend
- Uses only publishable Supabase key.
- Does not expose admin-only secrets.

## QR Links
- Temporary token.
- Expiration enforced server-side.
- Download count tracked.

## Admin
- Supabase Auth required.
- Roles: super_admin, admin, support, finance.
```

- [ ] **Step 5: Run verification**

```powershell
npm run lint
npm run build
npm run admin:build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/create-delivery-link/index.ts supabase/functions/create-kiosk-payment/index.ts docs/security-production-review.md
git commit -m "Document and harden production security"
```

---

## Task 6: Documentação Para O Dono Do Totem

**Files:**
- Create: `docs/totem-owner-quickstart.md`
- Modify: `docs/go-live-checklist.md`
- Modify: `apps/admin/src/lib/installInstructions.ts`
- Modify: `apps/admin/src/lib/installInstructions.test.ts`

- [ ] **Step 1: Write owner quickstart**

Create `docs/totem-owner-quickstart.md`:

```md
# Guia Rapido Do Dono Do Totem

## 1. Instalar
Baixe o instalador enviado pelo administrador e abra o arquivo `FanFrame Kiosk Setup`.

## 2. Conectar
Quando o app abrir, digite o codigo de instalacao enviado pelo administrador.

## 3. Testar
Abra o modo tecnico com o PIN enviado pelo administrador e toque em `Testar tudo`.

## 4. Verificar camera
Se a camera estiver invertida, use `Corrigir camera invertida`.

## 5. Atualizar
Quando o administrador avisar, abra o modo tecnico e toque em `Atualizar app`.

## 6. Problemas comuns
- Sem internet: verifique Wi-Fi ou cabo.
- Camera nao aparece: feche outros programas que usam camera.
- PIX nao aparece: chame o administrador.
```

- [ ] **Step 2: Improve install message**

In `apps/admin/src/lib/installInstructions.ts`, make the owner message include:

- installer link;
- installation code;
- support PIN;
- first test checklist;
- “não precisa mexer em Supabase, PagBank ou IA”.

- [ ] **Step 3: Test install instructions**

In `apps/admin/src/lib/installInstructions.test.ts`, assert message contains:

```ts
expect(message).toContain("Codigo de instalacao");
expect(message).toContain("PIN tecnico");
expect(message).toContain("Testar tudo");
expect(message).toContain("Nao mexa em Supabase, PagBank ou IA");
```

- [ ] **Step 4: Update go-live checklist**

In `docs/go-live-checklist.md`, add:

```md
## Antes de instalar em um ponto
- [ ] Time publicado no painel.
- [ ] Totem cadastrado com local e responsavel.
- [ ] Codigo de instalacao gerado.
- [ ] PIN tecnico enviado ao dono.
- [ ] Instalador baixado no PC do totem.
- [ ] Camera testada.
- [ ] PIX testado com valor baixo.
- [ ] QR final testado no celular.
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm --prefix apps/admin test -- src/lib/installInstructions.test.ts
npm run admin:build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit**

```powershell
git add docs/totem-owner-quickstart.md docs/go-live-checklist.md apps/admin/src/lib/installInstructions.ts apps/admin/src/lib/installInstructions.test.ts
git commit -m "Add owner installation documentation"
```

---

## Execution Order

1. Task 1: Atualização remota.
2. Task 2: QR mobile.
3. Task 3: Controle de assets.
4. Task 4: Monitoramento.
5. Task 5: Segurança.
6. Task 6: Documentação.

This order reduces risk: first make remote maintenance easier, then improve customer delivery, then add operational guardrails, then lock down production security and handoff docs.

## Final Verification

Run:

```powershell
npm run lint
npm run build
npm run admin:build
npm run dist:win
```

Expected:

- lint passes;
- kiosk build passes;
- admin build passes;
- Windows installer is generated in `release/`;
- Supabase function `create-delivery-link` is deployed after QR/security changes;
- Vercel deploys the admin after push to `main`.

