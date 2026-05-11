# FanFrame Totens

Sistema FanFrame adaptado para rede de totens Windows multi-time.

## Apps

- App principal: fluxo do provador/totem e build Electron.
- `apps/admin`: painel web separado para operar times, totens, vendas, pagamentos e usuarios.
- `supabase/functions`: Edge Functions para geracao IA, pagamentos, webhooks e administracao.

## Desenvolvimento

```bash
npm install
npm run dev
npm run admin:dev
```

## Builds

```bash
npm run build
npm run admin:build
npm run dist:win
```

## Operacao De Totens

- Guia tecnico: `docs/kiosk-totem.md`
- Guia do dono do totem: `docs/kiosk-installation-owner-guide.md`
- Checklist de entrada em operacao: `docs/go-live-checklist.md`
- Plano de rede gerenciada: `docs/superpowers/specs/2026-05-10-kiosk-network-operations-design.md`

## Variaveis

Configure o Supabase via:

```env
VITE_SUPABASE_PROJECT_ID="seu-project-ref"
VITE_SUPABASE_URL="https://seu-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publishable"
```

Secrets de backend ficam no Supabase. Enquanto a conta PagBank nao estiver liberada, use `KIOSK_SIMULATE_PAYMENTS=true` apenas para testes de laboratorio. Depois configure `PAGBANK_API_TOKEN` e desligue pagamentos simulados.
