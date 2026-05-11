# Checklist Para Colocar Totens Em Operacao

Use este checklist para separar o que ja pode ser testado do que depende da liberacao PagBank.

## 1. Supabase

- Aplicar migrations no projeto de producao.
- Publicar Edge Functions.
- Configurar `REPLICATE_API_TOKEN`.
- Configurar `KIOSK_SIMULATE_PAYMENTS=true` apenas para homologacao sem PagBank.
- Criar o primeiro usuario `super_admin`.
- Confirmar que o bucket `tryon-assets` aceita upload pelo painel admin.

Com a CLI logada ou `SUPABASE_ACCESS_TOKEN` definido, voce pode rodar:

```powershell
.\scripts\deploy-supabase-totem.ps1
```

Quando PagBank estiver liberado:

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

## 4. Fluxo Sem PagBank

Use somente para laboratorio:

- Ativar `simulatePayments` no `kiosk.config.json` ou `KIOSK_SIMULATE_PAYMENTS=true`.
- Fazer venda simulada.
- Capturar foto pela webcam.
- Enviar para IA.
- Receber QR Code de download.
- Conferir reset automatico.

## 5. Bloqueado Ate Ter PagBank

- PIX real com QR Code PagBank.
- Webhook PagBank real.
- Conciliacao real de pagamentos PIX.
- Cartao real com PlugPag homologado.
- Teste de negacao/cancelamento real pela maquininha.

## 6. Depois Da API PagBank

- Configurar `PAGBANK_API_TOKEN`.
- Configurar `PAGBANK_API_BASE` de sandbox ou producao.
- Configurar `PAGBANK_NOTIFICATION_URL`.
- Testar PIX sandbox.
- Testar PIX producao com valor baixo.
- Homologar PlugPag no PC Windows.
- Desligar pagamentos simulados.
- Fazer teste ponta a ponta com pagamento real.
