# Kiosk Online Test Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada totem tenha um link seguro para executar no celular ou computador o mesmo fluxo React do kiosk Windows, sempre em modo de teste.

**Architecture:** O app raiz continuará sendo a implementação única do kiosk e ganhará a rota `/teste-totem/:token`. Uma Edge Function valida o token e retorna apenas a identidade pública necessária do dispositivo. A criação de pagamento reconhece o token, força provedor simulado e marca sessões e gerações como `web_test`, sem expor o segredo real do equipamento.

**Tech Stack:** React/Vite, Electron compartilhando `Kiosk.tsx`, Supabase Postgres/RLS, Supabase Edge Functions, Vercel.

---

### Task 1: Persistência segura dos links

**Files:**
- Create: `supabase/migrations/20260625090000_add_kiosk_test_links.sql`
- Create: `supabase/functions/manage-kiosk-test-links/index.ts`
- Modify: `supabase/config.toml`
- Test: `src/lib/kioskOnlineTestArchitecture.test.ts`

- [ ] Criar teste estrutural exigindo tabela, hash do token, expiração e policies administrativas.
- [ ] Executar o teste e confirmar falha por ausência da estrutura.
- [ ] Criar tabela `kiosk_test_links` ligada a `kiosk_devices`, com somente um link ativo por dispositivo.
- [ ] Criar função com ações autenticadas `create`, `revoke`, `status` e ação pública `resolve`.
- [ ] Executar testes de arquitetura e validação das Edge Functions.

### Task 2: Fluxo real do kiosk no navegador

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Kiosk.tsx`
- Modify: `src/lib/kiosk.ts`
- Modify: `src/shared/kiosk-ui/kioskVisual.css`
- Modify: `supabase/functions/create-kiosk-payment/index.ts`
- Test: `src/lib/kioskOnlineTestArchitecture.test.ts`

- [ ] Criar teste exigindo rota `/teste-totem/:token`, resolução do token e origem `web_test`.
- [ ] Executar o teste e confirmar falha.
- [ ] Resolver o token no boot do kiosk sem persistir segredo do dispositivo.
- [ ] Desativar health check, comandos remotos e recuperação de fotos no modo web.
- [ ] Forçar pagamento simulado no backend e gravar `metadata.source = web_test`.
- [ ] Enviar geração com `source: web_test`.
- [ ] Exibir selo discreto `MODO DE TESTE` e ajustar viewport mobile.
- [ ] Executar testes do kiosk, typecheck, lint e build.

### Task 3: Controles por totem no painel

**Files:**
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/lib/deviceOperations.ts`
- Modify: `apps/admin/src/lib/types.ts`
- Test: `apps/admin/src/lib/kioskTestLinks.test.ts`

- [ ] Criar teste exigindo botões de criar, abrir, copiar, regenerar e desativar.
- [ ] Executar o teste e confirmar falha.
- [ ] Adicionar chamadas autenticadas para gerenciar o link.
- [ ] Mostrar o controle na lista e nos detalhes do dispositivo.
- [ ] Usar `VITE_KIOSK_TEST_ORIGIN` para montar a URL pública.
- [ ] Executar `npm --prefix apps/admin run check`.

### Task 4: Deploy e verificação ponta a ponta

**Files:**
- Modify: `.env.example`
- Modify: `docs/release-automation.md`

- [ ] Documentar `VITE_KIOSK_TEST_ORIGIN`.
- [ ] Aplicar migração e publicar Edge Functions.
- [ ] Publicar o app raiz em projeto Vercel próprio.
- [ ] Configurar a origem no painel.
- [ ] Criar link para um totem, abrir em viewport mobile e concluir camisa, CPF, pagamento simulado, câmera, IA e resultado.
- [ ] Confirmar que receita real continua ignorando pagamentos `simulated`.
- [ ] Confirmar que link revogado ou expirado é bloqueado.
