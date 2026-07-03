# FanFrame Agent Guide

## Escopo

Este repositorio contem quatro dominios ativos:

- Kiosk React/Vite: `src/pages/Kiosk.tsx` e `src/features/kiosk/`.
- UI compartilhada kiosk/preview: `src/shared/kiosk-ui/`.
- App Windows Electron: `electron/`.
- Painel remoto oficial: `apps/admin/`.
- Backend: `supabase/functions/` e `supabase/migrations/`.

Comece por `docs/architecture/INDEX.md`. Abra somente o fluxo relacionado a tarefa.

## Handoff First

Para um novo dev ou nova thread Codex, comece por `docs/HANDOFF.md`, depois use `docs/architecture/INDEX.md` para abrir somente o fluxo da tarefa. Nao carregue threads antigas gigantes como fonte primaria de contexto.

## Fontes De Verdade

- Admin oficial: `apps/admin`. `src/pages/admin` e legado e nao deve receber features novas.
- Fluxo do kiosk: `src/pages/Kiosk.tsx`.
- Componentes visuais usados pelo kiosk e preview: `src/shared/kiosk-ui/`.
- Tipos remotos do kiosk: `src/contexts/TeamContext.tsx` e `src/lib/kiosk.ts`.
- Schema: migrations em `supabase/migrations/`; nunca inferir schema apenas pelos tipos gerados.
- Release Windows: `scripts/release-kiosk.ps1` e `docs/release-automation.md`.

## Comandos

```powershell
npm run check:affected
npm run check:kiosk
npm run check:admin
npm run check:electron
npm run check:functions
npm run check:all
npm run context:map
npm run context:check
```

Use o menor check que prove a mudanca. `check:all` e obrigatorio somente para release ou contratos transversais.

## Regras

- Preserve mudancas existentes do usuario.
- Nao exponha tokens, senhas, service-role keys ou dados pessoais em frontend, logs, docs ou Git.
- Nao altere payloads publicos de Edge Functions sem migration/compatibilidade e teste de contrato.
- Pagamento confirmado nunca pode ser perdido por timeout, refresh ou transicao de tela.
- Admin e kiosk devem usar os mesmos componentes de `src/shared/kiosk-ui` para preview fiel.
- Nao adicione feature ao admin legado.
- Prefira arquivos focados; novo componente/hook acima de 300 linhas exige justificativa.
- Use `rg` e abra arquivos direcionados; nao leia lockfiles, builds ou planos historicos sem necessidade.
- Edite com `apply_patch` e mantenha mudancas fora do escopo intactas.

## Definicao De Pronto

- Existe teste para comportamento novo ou bug corrigido quando aplicavel.
- O check do dominio afetado passa.
- `npm run context:check` passa se estrutura, exports ou comandos mudaram.
- Mudancas visuais sao verificadas no viewport vertical 1080x1920.
- Mudancas de release passam em `npm run release:kiosk:verify`.
- O diff nao contem secrets, artefatos de build ou refatoracao nao solicitada.
