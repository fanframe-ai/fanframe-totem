# Kiosk Runtime

## Escopo

Este dominio controla sessao, pagamento, camera, geracao, resultado, recuperacao por CPF e modo tecnico.

## Regras Criticas

- Um pagamento confirmado deve sobreviver a espera, comandos remotos e timeouts.
- Nao reiniciar o fluxo durante pagamento, camera, geracao ou resultado sem acao explicita ou falha terminal.
- Configuracao remota so deve entrar em momento seguro da sessao.
- Configuracao local da camera deve persistir no Electron entre reinicios.
- CPF deve ser tratado como dado sensivel: minimo necessario, sem logs em texto aberto.
- Toda transicao nova precisa indicar origem, destino e condicao.

## Verificacao

```powershell
npm run check:kiosk
```

Mudancas de camera exigem teste no Electron/Windows; browser sozinho nao prova acesso ao dispositivo.

