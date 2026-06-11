# Kiosk Photo Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recuperar fotos recentes no mesmo totem usando o CPF do pagamento.

**Architecture:** Uma Edge Function autenticada pelo dispositivo consulta pagamentos e sessoes concluídas. O kiosk possui telas isoladas para CPF, historico e novo QR Code, reutilizando a entrega existente.

**Tech Stack:** React, TypeScript, Vite, Supabase Edge Functions, Supabase Postgres, Vitest.

---

### Task 1: Contrato e seguranca do backend

**Files:**
- Create: `supabase/functions/recover-kiosk-photos/index.ts`
- Modify: `supabase/config.toml`
- Test: `src/lib/edgeFunctionsArchitecture.test.ts`

- [x] Escrever teste que exige autenticacao do dispositivo, CPF exato, janela de 7 dias e limite de tentativas.
- [x] Confirmar falha pela ausencia da funcao.
- [x] Implementar busca e criacao de link temporario.
- [x] Executar `npm test -- --run src/lib/edgeFunctionsArchitecture.test.ts`.

### Task 2: Cliente de recuperacao

**Files:**
- Modify: `src/lib/kiosk.ts`
- Test: `src/lib/kiosk.test.ts`

- [x] Testar comportamento de inatividade e recarga das novas etapas.
- [x] Implementar chamadas `searchKioskPhotos` e `createRecoveredPhotoLink`.
- [x] Executar `npm test -- --run src/lib/kiosk.test.ts`.

### Task 3: Interface do kiosk

**Files:**
- Modify: `src/pages/Kiosk.tsx`
- Modify: `src/shared/kiosk-ui/KioskVisual.tsx`
- Modify: `src/shared/kiosk-ui/kioskVisual.css`
- Test: `src/lib/photoRecoveryArchitecture.test.ts`

- [x] Testar a presenca do botao e das etapas de recuperacao.
- [x] Adicionar CPF, lista de fotos e entrega por QR Code.
- [x] Validar em viewport vertical 1080x1920.

### Task 4: Verificacao e publicacao

- [x] Executar `npm run lint`.
- [x] Executar `npm test`.
- [x] Executar `npm run build`.
- [x] Publicar `recover-kiosk-photos` no Supabase.
- [ ] Gerar e publicar o instalador Windows atualizado.
