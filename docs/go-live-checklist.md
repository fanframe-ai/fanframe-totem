# Checklist Para Colocar Totens Em Operacao

Use este checklist para separar o que ja pode ir para operacao do que ainda depende de homologacao em ambiente real.

## 1. Supabase

- Aplicar migrations no projeto de producao.
- Publicar Edge Functions.
- Configurar `REPLICATE_API_TOKEN`.
- Configurar `KIOSK_SIMULATE_PAYMENTS=false` quando o sandbox/produção PagBank estiver ativo.
- Criar o primeiro usuario `super_admin`.
- Confirmar que o bucket `tryon-assets` aceita upload pelo painel admin.

Com a CLI logada ou `SUPABASE_ACCESS_TOKEN` definido, voce pode rodar:

```powershell
.\scripts\deploy-supabase-totem.ps1
```

Para publicar tambem o webhook PagBank:

```powershell
.\scripts\deploy-supabase-totem.ps1 -IncludePagBank
```

## 2. Admin

- Criar pelo menos um time real.
- Enviar logo, camisas e cenarios.
- Configurar preco e instrucao da IA.
- Cadastrar um totem com cidade, ponto e responsavel.
- Clicar em `Instalar` e copiar a mensagem de instalacao.
- Confirmar que o totem aparece como online depois de pareado.

## 3. Windows Do Totem

- Gerar instalador com `npm run dist:win`.
- Instalar em PC Windows real.
- Conferir tela vertical.
- Parear com codigo de instalacao.
- Abrir modo tecnico com `Ctrl + Shift + F12`.
- Testar internet, Supabase, camera e diagnostico.
- Validar que o app reinicia e volta pareado.

## 4. PagBank Sandbox

O sandbox usa pagamentos reais de teste, sem dinheiro real:

- Configurar `PAGBANK_API_TOKEN` com token sandbox.
- Configurar `PAGBANK_API_BASE=https://sandbox.api.pagseguro.com`.
- Configurar `PAGBANK_NOTIFICATION_URL` apontando para `pagbank-webhook`.
- Manter `KIOSK_SIMULATE_PAYMENTS=false`.
- Rodar `.\scripts\test-pagbank-sandbox.ps1`.
- Fazer venda PIX sandbox pelo app.
- Capturar foto pela webcam.
- Enviar para IA.
- Receber QR Code de download.
- Conferir reset automatico.

## 5. Fluxo Simulado

Use somente quando a internet/API estiver fora do escopo do teste:

- Ativar `simulatePayments` no `kiosk.config.json` ou `KIOSK_SIMULATE_PAYMENTS=true`.
- Fazer venda simulada.
- Validar webcam, IA, QR Code e reset automatico.

## 6. Antes De Producao

- Trocar `PAGBANK_API_TOKEN` para token de producao.
- Trocar `PAGBANK_API_BASE` para a base de producao PagBank.
- Testar PIX producao com valor baixo.
- Homologar PlugPag no PC Windows.
- Testar cartao real na maquininha.
- Testar negacao/cancelamento real pela maquininha.
- Desligar pagamentos simulados.
- Fazer teste ponta a ponta com pagamento real.
