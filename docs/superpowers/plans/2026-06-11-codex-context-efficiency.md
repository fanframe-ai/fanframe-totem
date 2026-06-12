# FanFrame Codex Context Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir drasticamente o contexto que o Codex precisa ler, o tempo ate a primeira edicao e o custo de validacao de qualquer mudanca no FanFrame, sem alterar o comportamento atual do kiosk, admin, Supabase ou Electron.

**Architecture:** Aplicar progressive disclosure ao proprio repositorio: instrucoes curtas e hierarquicas, mapas de arquitetura por dominio, comandos de verificacao direcionados e codigo dividido por feature. A migracao sera incremental; rotas, tabelas, Edge Functions e contratos publicos permanecem estaveis enquanto arquivos monoliticos sao extraidos em partes testaveis.

**Tech Stack:** React 18, TypeScript, Vite, Electron, Supabase/Postgres/Edge Functions, Vitest, ESLint, PowerShell, Codex `AGENTS.md` e repo skills.

---

## 1. Diagnostico Atual

O repositorio tem 275 arquivos versionados e 16 arquivos de teste. Os principais pontos que aumentam leitura, busca e risco sao:

| Arquivo | Tamanho atual | Problema |
| --- | ---: | --- |
| `apps/admin/src/App.tsx` | 3.487 linhas | Auth, layout, dashboard, times, builder, totens, vendas, problemas, usuarios e entrega no mesmo arquivo |
| `src/shared/kiosk-ui/kioskVisual.css` | 2.298 linhas | Todas as telas e variacoes visuais em uma folha global |
| `src/pages/Kiosk.tsx` | 1.721+ linhas | Estado do fluxo, camera, pagamento, recovery, diagnostico e renderizacao juntos |
| `src/shared/kiosk-ui/KioskVisual.tsx` | 678 linhas | Nove telas visuais no mesmo modulo |
| `supabase/functions/generate-tryon/index.ts` | 758 linhas | Validacao, prompt, assets, Replicate e persistencia juntos |

Problemas adicionais:

- Nao existe `AGENTS.md`; cada thread precisa redescobrir arquitetura, comandos e restricoes.
- O README explica a composicao geral, mas nao informa "onde alterar cada comportamento".
- O admin nao tem scripts proprios de teste, lint ou typecheck.
- A verificacao tende a usar `npm run lint`, `npm test` ou builds amplos mesmo em mudancas locais.
- Existem paginas antigas em `src/pages/admin`, embora o admin oficial esteja em `apps/admin`; isso gera resultados de busca ambiguos.
- Os testes arquiteturais atuais ajudam a proteger contratos, mas varios inspecionam texto-fonte e nao substituem testes de comportamento por feature.
- Documentos historicos extensos aparecem nas buscas junto com a arquitetura vigente.

## 2. Metas Mensuraveis

Ao final:

- Uma tarefa simples deve exigir leitura de no maximo 5 a 8 arquivos antes da edicao.
- O contexto inicial automatico do repositorio deve ficar abaixo de 12 KB.
- `apps/admin/src/App.tsx` deve ficar abaixo de 180 linhas.
- O orquestrador principal do kiosk deve ficar abaixo de 350 linhas.
- Nenhum componente ou hook novo deve ultrapassar 300 linhas sem justificativa registrada.
- CSS de cada tela deve ficar em arquivo proprio, preferencialmente abaixo de 400 linhas.
- Cada dominio deve possuir um comando de verificacao que termine, em maquina local normal, em menos de 90 segundos.
- O build completo de kiosk + admin + Electron deve ser reservado para mudancas transversais e releases.
- Meta operacional: reduzir em 50% a 75% o contexto lido em correcoes locais. Isso sera medido por arquivos abertos, nao por uma promessa abstrata de tokens.

## 3. Estrutura-Alvo

```text
franframe/
  AGENTS.md
  .agents/
    skills/
      fanframe-admin-change/SKILL.md
      fanframe-kiosk-change/SKILL.md
      fanframe-edge-function/SKILL.md
      fanframe-release/SKILL.md
      fanframe-debug/SKILL.md
  .codex/
    context-map.md                 # gerado, curto e versionado
    verification-matrix.md         # qual comando usar por tipo de mudanca
  docs/
    architecture/
      INDEX.md
      kiosk-flow.md
      admin-publish-flow.md
      payment-flow.md
      generation-flow.md
      delivery-flow.md
      data-model.md
      decisions/
    archive/
      plans/
  apps/admin/
    AGENTS.md
    src/
      app/
      features/
        dashboard/
        teams/
        team-builder/
        devices/
        sales/
        problems/
        users/
        delivery/
      shared/
  src/
    features/kiosk/
      AGENTS.md
      state/
      hooks/
      services/
      technical/
    shared/kiosk-ui/
      AGENTS.md
      screens/
      styles/
  supabase/
    AGENTS.md
    functions/
      _shared/
  electron/
    AGENTS.md
```

O kiosk permanece no app raiz nesta etapa. Mover tudo para `apps/kiosk` causaria um diff grande, alteraria build/release e ofereceria pouco ganho imediato de contexto.

## 4. Fase 1: Camada De Contexto, Sem Refatorar Produto

### Task 1: Criar instrucoes hierarquicas

**Files:**
- Create: `AGENTS.md`
- Create: `apps/admin/AGENTS.md`
- Create: `src/features/kiosk/AGENTS.md`
- Create: `src/shared/kiosk-ui/AGENTS.md`
- Create: `supabase/AGENTS.md`
- Create: `electron/AGENTS.md`

- [ ] Escrever o `AGENTS.md` raiz com ate 120 linhas contendo somente mapa do repo, comandos, regras de seguranca, fonte de verdade e definicao de pronto.
- [ ] Colocar regras especificas perto de cada dominio, mantendo cada arquivo abaixo de 80 linhas.
- [ ] Declarar explicitamente que `apps/admin` e o admin oficial e que `src/pages/admin` e legado ate ser removido.
- [ ] Registrar que secrets nunca entram em frontend, logs, commits ou documentos.
- [ ] Definir verificacao proporcional: teste local primeiro; build completo somente quando o contrato atravessar dominios.
- [ ] Verificar a cadeia com `codex --ask-for-approval never "Resuma as instrucoes ativas"` a partir da raiz e dos subdiretorios.

### Task 2: Criar o mapa de arquitetura navegavel

**Files:**
- Create: `docs/architecture/INDEX.md`
- Create: `docs/architecture/kiosk-flow.md`
- Create: `docs/architecture/admin-publish-flow.md`
- Create: `docs/architecture/payment-flow.md`
- Create: `docs/architecture/generation-flow.md`
- Create: `docs/architecture/delivery-flow.md`
- Create: `docs/architecture/data-model.md`
- Modify: `README.md`

- [ ] Fazer `INDEX.md` responder em uma tela: "quero mudar X; quais arquivos devo abrir?".
- [ ] Limitar cada documento de fluxo a contexto atual, entradas, saidas, fonte de verdade, arquivos e comando de teste.
- [ ] Documentar os fluxos com diagramas Mermaid pequenos e sem copiar implementacao.
- [ ] Referenciar apenas o indice no `AGENTS.md`; Codex abre o fluxo detalhado somente quando a tarefa exigir.
- [ ] Remover do `README.md` instrucoes que duplicam os documentos e manter links canonicos.

### Task 3: Gerar mapa tecnico deterministico

**Files:**
- Create: `scripts/generate-context-map.mjs`
- Create: `.codex/context-map.md`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] O script deve listar por dominio: arquivos, exports principais, linhas, testes vizinhos e comandos disponiveis.
- [ ] Ignorar `node_modules`, `dist`, `release`, lockfiles, assets binarios e documentos arquivados.
- [ ] Adicionar `npm run context:map`.
- [ ] Fazer o script falhar se o mapa gerado estiver desatualizado em `npm run context:check`.
- [ ] Manter o mapa abaixo de 300 linhas; ele e indice, nao dump do repositorio.

## 5. Fase 2: Verificacao Rapida E Direcionada

### Task 4: Criar matriz de comandos por dominio

**Files:**
- Create: `.codex/verification-matrix.md`
- Modify: `package.json`
- Modify: `apps/admin/package.json`
- Modify: `eslint.config.js`
- Create: `apps/admin/vitest.config.ts`

- [ ] Adicionar `typecheck:kiosk`, `test:kiosk`, `lint:kiosk` e `check:kiosk`.
- [ ] Adicionar no admin `typecheck`, `test`, `lint` e `check`.
- [ ] Adicionar `test:electron` e `check:electron`.
- [ ] Adicionar `check:functions` para typecheck/testes das Edge Functions sem executar deploy.
- [ ] Adicionar `check:all` como agregador de release, nunca como padrao para uma mudanca pequena.
- [ ] Mapear exemplos: CSS da Home usa teste visual + build kiosk; Edge Function usa teste da funcao + typecheck; release usa tudo.

### Task 5: Criar seletor de testes afetados

**Files:**
- Create: `scripts/check-affected.mjs`
- Create: `scripts/affected-rules.json`
- Modify: `package.json`

- [ ] Ler caminhos alterados pelo Git e mapear para checks declarados em JSON.
- [ ] Executar apenas os checks dos dominios afetados com `npm run check:affected`.
- [ ] Escalar automaticamente para `check:all` ao alterar contratos compartilhados, migrations, configs de build ou lockfiles.
- [ ] Imprimir os motivos da selecao para que Codex nao repita a descoberta.

## 6. Fase 3: Dividir O Admin Sem Mudar A Interface

### Task 6: Transformar `App.tsx` em composicao de rotas

**Files:**
- Modify: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/app/AdminRouter.tsx`
- Create: `apps/admin/src/app/AdminLayout.tsx`
- Create: `apps/admin/src/app/auth.tsx`
- Create: `apps/admin/src/app/permissions.ts`
- Create: `apps/admin/src/shared/formatters.ts`
- Create: `apps/admin/src/shared/supabase.ts`

- [ ] Extrair primeiro auth, layout, gates e utilitarios puros, mantendo assinaturas e markup.
- [ ] Criar testes unitarios para permissao, formatacao e URL antes de remover as funcoes originais.
- [ ] Deixar `App.tsx` responsavel apenas por providers e `AdminRouter`.
- [ ] Confirmar login, logout e bloqueio de rotas com build e teste do admin.

### Task 7: Extrair uma feature do admin por commit

**Files:**
- Create: `apps/admin/src/features/dashboard/*`
- Create: `apps/admin/src/features/teams/*`
- Create: `apps/admin/src/features/team-builder/*`
- Create: `apps/admin/src/features/devices/*`
- Create: `apps/admin/src/features/sales/*`
- Create: `apps/admin/src/features/problems/*`
- Create: `apps/admin/src/features/users/*`
- Create: `apps/admin/src/features/delivery/*`
- Modify: `apps/admin/src/App.tsx`

- [ ] Ordem obrigatoria de extracao: dashboard, sales, problems, users, delivery, devices, teams, team-builder.
- [ ] Em cada feature, separar `Page.tsx`, `api.ts`, `types.ts`, `components/` e teste somente quando esses papeis existirem.
- [ ] Nao criar barrel files globais; imports diretos tornam dependencias mais claras para ferramentas e agentes.
- [ ] Preservar query, mutation, copy e CSS durante a extracao; melhorias de UX ficam para commits posteriores.
- [ ] Ao final, remover apenas imports comprovadamente mortos.

## 7. Fase 4: Dividir O Kiosk Por Estado E Capacidade

### Task 8: Isolar a maquina de fluxo

**Files:**
- Modify: `src/pages/Kiosk.tsx`
- Create: `src/features/kiosk/types.ts`
- Create: `src/features/kiosk/state/kioskReducer.ts`
- Create: `src/features/kiosk/state/kioskTransitions.ts`
- Create: `src/features/kiosk/state/kioskReducer.test.ts`

- [ ] Converter transicoes dispersas de `setStep` em eventos nomeados sem introduzir biblioteca de state machine.
- [ ] Testar caminhos criticos: home, camisa, CPF, pagamento, camera, geracao, resultado, recuperacao e manutencao.
- [ ] Proibir transicoes que descartem sessao paga.
- [ ] Manter efeitos externos fora do reducer.

### Task 9: Extrair capacidades do kiosk

**Files:**
- Create: `src/features/kiosk/hooks/useKioskBootstrap.ts`
- Create: `src/features/kiosk/hooks/useKioskPayment.ts`
- Create: `src/features/kiosk/hooks/useKioskCamera.ts`
- Create: `src/features/kiosk/hooks/usePhotoRecovery.ts`
- Create: `src/features/kiosk/hooks/useKioskCommands.ts`
- Create: `src/features/kiosk/technical/TechnicalOverlay.tsx`
- Create: `src/features/kiosk/services/kioskApi.ts`
- Modify: `src/pages/Kiosk.tsx`

- [ ] Extrair uma capacidade por commit com testes do comportamento existente.
- [ ] Centralizar chamadas de Edge Functions em `kioskApi.ts`, com tipos de request/response.
- [ ] Manter `Kiosk.tsx` como orquestrador que combina estado, hooks e telas.
- [ ] Garantir que camera e pagamento liberem recursos no unmount e em reset de sessao.

## 8. Fase 5: Dividir O Visual Compartilhado

### Task 10: Um componente e um CSS por tela

**Files:**
- Modify: `src/shared/kiosk-ui/KioskVisual.tsx`
- Modify: `src/shared/kiosk-ui/kioskVisual.css`
- Create: `src/shared/kiosk-ui/screens/KioskShell.tsx`
- Create: `src/shared/kiosk-ui/screens/HomeScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/SelectionScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/CpfScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/PaymentScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/CameraScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/GeneratingScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/ResultScreen.tsx`
- Create: `src/shared/kiosk-ui/screens/RecoveryScreen.tsx`
- Create: `src/shared/kiosk-ui/styles/*.css`

- [ ] Mover markup e CSS sem redesenhar.
- [ ] Manter seletores publicos temporarios para evitar regressao visual.
- [ ] Fazer admin builder e kiosk importarem exatamente os mesmos componentes, props e CSS.
- [ ] Criar testes visuais ou screenshots para Home, camisa, CPF, PIX, camera, geracao e resultado em 1080x1920.
- [ ] Remover o arquivo agregado somente depois de zerar imports antigos.

## 9. Fase 6: Backend E Contratos

### Task 11: Compartilhar infraestrutura das Edge Functions

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/_shared/deviceAuth.ts`
- Create: `supabase/functions/_shared/adminAuth.ts`
- Create: `supabase/functions/_shared/supabase.ts`
- Create: `supabase/functions/_shared/errors.ts`
- Modify: `supabase/functions/*/index.ts`

- [ ] Extrair apenas codigo repetido comprovado em pelo menos duas funcoes.
- [ ] Padronizar respostas de erro com `code`, `message` e `details` opcionais.
- [ ] Manter nomes, payloads e status HTTP publicos compativeis.
- [ ] Adicionar teste de contrato para cada funcao critica antes da migracao.

### Task 12: Dividir `generate-tryon`

**Files:**
- Modify: `supabase/functions/generate-tryon/index.ts`
- Create: `supabase/functions/generate-tryon/request.ts`
- Create: `supabase/functions/generate-tryon/prompt.ts`
- Create: `supabase/functions/generate-tryon/assets.ts`
- Create: `supabase/functions/generate-tryon/replicate.ts`
- Create: `supabase/functions/generate-tryon/persistence.ts`

- [ ] Fixar snapshots dos payloads enviados ao Replicate antes da extracao.
- [ ] Separar parsing, resolucao de assets, composicao de prompt, chamada externa e persistencia.
- [ ] Fazer `index.ts` somente autenticar, orquestrar e responder.
- [ ] Verificar cenario fixo, aspect ratio, uma ou duas pessoas e webhook.

## 10. Fase 7: Repo Skills Para Tarefas Repetidas

### Task 13: Criar skills com progressive disclosure

**Files:**
- Create: `.agents/skills/fanframe-admin-change/SKILL.md`
- Create: `.agents/skills/fanframe-kiosk-change/SKILL.md`
- Create: `.agents/skills/fanframe-edge-function/SKILL.md`
- Create: `.agents/skills/fanframe-debug/SKILL.md`
- Create: `.agents/skills/fanframe-release/SKILL.md`

- [ ] Cada descricao deve dizer claramente quando usar e quando nao usar.
- [ ] Cada skill deve apontar primeiro para o documento de arquitetura do dominio e depois para os arquivos de entrada.
- [ ] Incluir comandos deterministas, criterios de pronto e limite de escopo.
- [ ] Evitar repetir as mesmas regras em cinco skills; regras comuns ficam no `AGENTS.md`.
- [ ] Manter cada skill abaixo de 120 linhas e mover detalhes extensos para `references/` somente quando necessario.

## 11. Fase 8: Limpeza E Fonte De Verdade

### Task 14: Remover ambiguidades e documentacao obsoleta

**Files:**
- Review/remove: `src/pages/admin/*`
- Review/remove: `src/components/admin/*`
- Move: `docs/superpowers/plans/*` antigos para `docs/archive/plans/`
- Modify: `docs/DOCUMENTATION.md`
- Modify: `README.md`

- [ ] Confirmar por imports e rotas que paginas antigas nao participam do build oficial.
- [ ] Remover legado em commit separado, com build antes e depois.
- [ ] Manter apenas documentos atuais no caminho principal de busca.
- [ ] Substituir changelog manual desatualizado por links para GitHub Releases e migrations.
- [ ] Nao versionar `.env`, tokens, dumps, logs locais, `dist` ou `release`.

## 12. Protocolo De Uso Do Codex Depois Da Organizacao

Para tarefas pequenas, o prompt padrao deve conter quatro campos:

```text
Objetivo: corrigir ou alterar um comportamento concreto.
Contexto: dominio e tela/funcao afetada; anexar erro ou imagem quando existir.
Restricoes: o que nao pode mudar.
Pronto quando: comportamento observavel e comando de verificacao esperado.
```

Regras operacionais:

1. Abrir uma thread nova para cada bug ou melhoria independente.
2. Iniciar no subdiretorio do dominio quando possivel, para carregar apenas as instrucoes proximas.
3. Usar raciocinio baixo em copy, CSS e mudancas locais bem delimitadas; medio/alto em pagamentos, estado, concorrencia e bugs intermitentes.
4. Usar subagentes somente para exploracao, logs e revisoes independentes. Eles consomem mais tokens; nao sao padrao para uma correcao pequena.
5. Pedir primeiro o check direcionado. Rodar `check:all` apenas em contratos compartilhados e releases.
6. Encerrar a thread depois do deploy/release; nao acumular dezenas de tarefas diferentes no mesmo contexto.
7. Quando o Codex repetir o mesmo erro duas vezes, atualizar o `AGENTS.md`, mapa ou skill correspondente.

## 13. Ordem Recomendada E Risco

| Ordem | Entrega | Risco | Ganho imediato |
| ---: | --- | --- | --- |
| 1 | AGENTS + mapa de arquitetura | Muito baixo | Alto |
| 2 | Matriz e checks direcionados | Baixo | Alto |
| 3 | Context map gerado | Baixo | Medio |
| 4 | Extracao do admin | Medio | Muito alto |
| 5 | State/hook split do kiosk | Medio/alto | Muito alto |
| 6 | Split visual/CSS | Medio | Alto |
| 7 | Shared Edge Functions | Medio | Alto |
| 8 | Skills do repo | Baixo | Alto e recorrente |
| 9 | Remocao de legado | Medio | Medio |

Nao executar as fases 4 a 9 em um unico PR. Cada feature extraida deve compilar, testar e ser reversivel de forma independente.

## 14. Gate Final

- [ ] `npm run context:check`
- [ ] `npm run check:affected`
- [ ] `npm run check:all`
- [ ] `npm run release:kiosk:verify`
- [ ] Fluxo real: instalar/conectar -> escolher camisa -> CPF -> PIX -> camera -> IA -> QR -> recuperar por CPF.
- [ ] Admin: login -> editar time -> publicar -> kiosk receber no momento seguro -> vendas/fotos/totens.
- [ ] Nenhum segredo em Git, bundle frontend ou logs.
- [ ] `AGENTS.md` e documentos refletem os comandos realmente existentes.
- [ ] Medir e registrar: arquivos lidos e tempo ate a primeira edicao em tres tarefas reais antes/depois.

## Decisao Principal

O primeiro ciclo deve implementar apenas as Fases 1 e 2. Elas entregam boa parte do ganho de velocidade sem tocar no comportamento do produto. Depois disso, a refatoracao deve ocorrer quando cada area voltar a ser modificada, evitando uma reescrita ampla e arriscada.
