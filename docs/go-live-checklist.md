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

## Antes de instalar em um ponto

- [ ] Time publicado no painel.
- [ ] Totem cadastrado com local e responsavel.
- [ ] Codigo de instalacao gerado.
- [ ] PIN tecnico enviado ao dono.
- [ ] Instalador baixado no PC do totem.
- [ ] Camera testada.
- [ ] PIX testado com valor baixo.
- [ ] QR final testado no celular.

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

## 4. PagBank Producao

O fluxo oficial do totem usa apenas PIX:

- Configurar `PAGBANK_API_TOKEN` com token de producao.
- Configurar `PAGBANK_API_BASE=https://api.pagseguro.com`.
- Configurar `PAGBANK_NOTIFICATION_URL` apontando para `pagbank-webhook`.
- Manter `KIOSK_SIMULATE_PAYMENTS=false`.
- Fazer venda PIX producao pelo app.
- Capturar foto pela webcam.
- Enviar para IA.
- Receber QR Code de download.
- Conferir reset automatico.

## 5. Fluxo Simulado

Use somente quando a internet/API estiver fora do escopo do teste:

- Ativar `Pagamento teste` no modo tecnico do app.
- Fazer venda simulada.
- Validar webcam, IA, QR Code e reset automatico.

## 6. Antes De Producao

- Trocar `PAGBANK_API_TOKEN` para token de producao.
- Confirmar `PAGBANK_API_BASE=https://api.pagseguro.com`.
- Testar PIX producao com valor baixo.
- Desligar `Pagamento teste` no modo tecnico do app.
- Fazer teste ponta a ponta com pagamento real.
