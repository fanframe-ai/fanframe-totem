# FanFrame Kiosk Totem

## Visao Geral

O modo kiosk roda o FanFrame como software desktop Windows via Electron. Cada PC fica preso a um totem cadastrado no painel admin e recebe time, preco, camisas, cenarios e prompt pela nuvem.

Fluxo do cliente:

1. Home do time.
2. Escolha de camisa.
3. Escolha de cenario.
4. Pagamento PIX ou cartao.
5. Captura por webcam.
6. Geracao IA.
7. QR Code para download da imagem.
8. Reset automatico.

## Modelo De Instalacao

O dono do totem nao edita arquivos tecnicos.

1. Admin cria o time no painel.
2. Admin cadastra o totem em `Totens`.
3. Admin clica em `Instalar` e copia a mensagem de instalacao.
4. Dono instala o app Windows.
5. App abre em `Conectar este totem`.
6. Dono digita o codigo de instalacao.
7. App baixa a configuracao e salva a identidade local.

Depois do pareamento, o PC usa `deviceCode + deviceSecret` salvos localmente. Pagamentos e health checks so funcionam se o totem existir, estiver ativo e estiver pareado.

## Configuracao Local Opcional

`kiosk.config.json` e apenas para suporte tecnico do PC. O fluxo normal usa pareamento por codigo.

Campos uteis:

- `fullscreen`: abre em tela cheia.
- `kiosk`: ativa modo kiosk.
- `autoLaunch`: inicia junto com o Windows quando instalado.
- `blockShortcuts`: bloqueia atalhos comuns de fuga.
- `simulatePayments`: aprova pagamentos em modo teste.
- `payments.simulate`: alternativa para modo teste.
- `payments.plugpagCommand`: comando local homologado com PlugPag.
- `payments.plugpagArgs`: argumentos do comando PlugPag.

Use `simulatePayments: true` somente para laboratorio sem cobranca real. Com sandbox ou producao PagBank ativo, deixe pagamentos simulados desligados.

## Admin

No painel:

- crie times;
- configure preco em reais;
- envie camisas e cenarios;
- ajuste a instrucao da IA;
- cadastre totens e contatos dos donos;
- gere codigo de instalacao;
- veja online/offline, erros, versao e instalacao;
- pause/libere vendas remotamente;
- solicite diagnostico e reinicio do app.

## Supabase

Para usar um projeto novo:

1. Atualize `.env` e `apps/admin/.env` com `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Confira `supabase/config.toml` com o `project_id`.
3. Aplique migrations.
4. Publique as Edge Functions.
5. Configure secrets.

Functions usadas pelo totem:

- `redeem-kiosk-install-code`
- `report-kiosk-health`
- `poll-kiosk-commands`
- `create-kiosk-payment`
- `create-delivery-link`
- `generate-tryon`
- `replicate-webhook`
- `pagbank-webhook`

Secrets esperados:

- `REPLICATE_API_TOKEN`
- `PAGBANK_API_TOKEN`
- `PAGBANK_API_BASE`
- `PAGBANK_NOTIFICATION_URL`
- `KIOSK_SIMULATE_PAYMENTS=false` para sandbox/producao PagBank

Para teste sem cobranca real, use `KIOSK_SIMULATE_PAYMENTS=true` somente em laboratorio.

## Windows

Build do app:

```powershell
npm run dist:win
```

Para validar sem gerar instalador completo:

```powershell
npm run dist:win:dir
```

Para testar com Vite em janela Electron:

```powershell
npm run dev
npm run electron:dev
```

## PagBank E PlugPag

PIX usa a API de pedidos/QR Code do PagBank via `create-kiosk-payment`. Sem `PAGBANK_API_TOKEN`, o PIX real fica bloqueado antes de criar cobranca.

Para validar o sandbox PagBank direto pela API:

```powershell
$env:PAGBANK_API_TOKEN = "token-sandbox"
.\scripts\test-pagbank-sandbox.ps1
```

Cartao usa a bridge Electron. Em producao, configure `payments.plugpagCommand` para chamar o adaptador local homologado com PlugPag. O comando recebe JSON por stdin e deve responder JSON por stdout:

```json
{
  "approved": true,
  "status": "approved",
  "transactionCode": "..."
}
```

Enquanto `simulatePayments` estiver ativo, o totem aprova pagamentos localmente para validar fluxo, webcam, IA e QR Code.
