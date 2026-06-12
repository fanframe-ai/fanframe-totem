# Mapa De Arquitetura FanFrame

Use este arquivo como roteador de contexto. Abra apenas o documento e os arquivos da linha relacionada a tarefa.

| Quero alterar | Leia primeiro | Arquivos de entrada | Check |
| --- | --- | --- | --- |
| Fluxo/telas do kiosk | `kiosk-flow.md` | `src/pages/Kiosk.tsx`, `src/shared/kiosk-ui/` | `npm run check:kiosk` |
| Preview/construtor do time | `admin-publish-flow.md` | `apps/admin/src/App.tsx`, `src/shared/kiosk-ui/` | `npm run check:admin` |
| Times, textos, assets e preco | `admin-publish-flow.md` | `apps/admin/src/App.tsx`, `src/contexts/TeamContext.tsx` | `npm run check:admin` |
| PIX/PagBank/CPF | `payment-flow.md` | `create-kiosk-payment`, `pagbank-webhook`, `Kiosk.tsx` | `npm run check:functions && npm run check:kiosk` |
| Camera e foto | `kiosk-flow.md` | `Kiosk.tsx`, `electron/` | `npm run check:kiosk && npm run check:electron` |
| Prompt/modelo/Replicate | `generation-flow.md` | `generate-tryon`, `replicate-webhook` | `npm run check:functions` |
| QR/download/pagina mobile | `delivery-flow.md` | `create-delivery-link`, `apps/admin` | `npm run check:functions && npm run check:admin` |
| Banco, RLS ou roles | `data-model.md` | `supabase/migrations/` | `npm run check:functions` |
| Instalador/atualizacao Windows | `../../docs/release-automation.md` | `electron/`, `scripts/release-kiosk.ps1` | `npm run check:electron` |

## Contratos Transversais

- `TeamRow` e configuracoes publicadas conectam admin, kiosk e Supabase.
- `src/shared/kiosk-ui` conecta preview e runtime.
- `kiosk_devices.device_secret` autentica operacoes locais do equipamento.
- `kiosk_session_id`, `payment_id` e `generation_queue` conectam venda, geracao e entrega.

Se uma mudanca tocar mais de um contrato transversal, execute `npm run check:all` antes da entrega.

