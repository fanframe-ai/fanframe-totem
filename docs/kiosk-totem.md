# FanFrame Kiosk Totem

## Visao Geral

O modo kiosk roda o FanFrame como um software desktop Windows via Electron. Cada PC fica preso a um time por configuracao local e usa o admin web para controlar assets, preco, branding e status.

Fluxo do usuario:

1. Home do time
2. Escolha de camisa
3. Escolha de cenario
4. Pagamento PIX ou cartao
5. Captura por webcam
6. Geracao IA
7. QR Code para download da imagem
8. Reset automatico

## Configuracao Local

Copie `kiosk.config.example.json` para `kiosk.config.json` no diretorio do app ou defina `FANFRAME_KIOSK_CONFIG` apontando para o arquivo.

Campos principais:

- `teamSlug`: slug do time criado no admin.
- `deviceCode`: identificador unico do PC/totem.
- `deviceSecret`: segredo compartilhado com as Edge Functions para registrar/validar o dispositivo.
- `simulatePayments`: `true` para homologacao sem maquininha.
- `payments.plugpagCommand`: comando local que integra com o SDK PlugPag homologado.

## Admin

No painel do time, aba `Totem`:

- Ative o modo totem.
- Configure preco em centavos.
- Ajuste timeout.
- Escolha se o totem mostra a etapa de camisa e/ou cenario.

## Supabase

Para usar um projeto novo, atualize:

- `.env` com `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `supabase/config.toml` com o `project_id` do novo projeto.

Aplique a migration:

```bash
supabase db push
```

Depois publique as Edge Functions novas:

- `create-kiosk-payment`
- `pagbank-webhook`
- `create-delivery-link`
- `generate-tryon`
- `replicate-webhook`

Secrets esperados:

- `REPLICATE_API_TOKEN`
- `PAGBANK_API_TOKEN`
- `PAGBANK_API_BASE` opcional, padrao `https://sandbox.api.pagseguro.com`
- `PAGBANK_NOTIFICATION_URL` opcional
- `KIOSK_SIMULATE_PAYMENTS=true` apenas para homologacao

## Windows

Build do app:

```bash
npm run dist:win
```

O instalador sai em `release/FanFrame Kiosk Setup 0.0.0.exe`.

Para testar com Vite em uma janela Electron:

```bash
npm run dev
npm run electron:dev
```

## PagBank

PIX usa a API de pedidos/QR Code do PagBank via `create-kiosk-payment`.

Cartao usa a bridge Electron. Em producao, configure `payments.plugpagCommand` para chamar o adaptador local homologado com PlugPag. O comando recebe o JSON do pagamento por stdin e deve responder JSON por stdout:

```json
{
  "approved": true,
  "status": "approved",
  "transactionCode": "..."
}
```

Enquanto `simulatePayments` estiver ativo, o totem aprova pagamentos localmente para validar fluxo, webcam e IA.
