# Guia De Instalacao Do Dono Do Totem

## O Que Voce Precisa

- PC Windows ligado ao totem.
- Internet estavel.
- Webcam conectada.
- Maquininha PlugPag configurada quando houver pagamento por cartao real.
- Mensagem de instalacao enviada pelo administrador FanFrame, com codigo de instalacao, PIN tecnico, time e local.

## Primeiro Acesso

1. Instale o FanFrame Kiosk.
2. Abra o aplicativo.
3. Digite o codigo de instalacao da mensagem recebida.
4. Confira se a tela inicial aparece com o time correto.
5. Aguarde a tela inicial do totem.

## Checklist De Instalacao

- O app abriu em tela cheia vertical.
- O time exibido esta correto.
- A internet aparece como online no modo tecnico.
- A camera foi detectada no modo tecnico.
- A camera detectada e a webcam fisica, nao `OBS Virtual Camera`.
- O diagnostico foi enviado para o painel.
- A maquininha PlugPag esta conectada quando houver pagamento por cartao real.
- O administrador confirmou que o totem aparece online no painel.

## Testes Locais

Abra o modo tecnico com `Ctrl + Shift + F12` e digite o PIN tecnico informado pelo administrador.

O PIN e exclusivo daquele totem. Se o administrador trocar o PIN, ele enviara um novo codigo de instalacao para parear o app novamente.

Use:

- Testar internet.
- Testar camera.
- Testar pagamentos.
- Sincronizar agora.
- Reiniciar app.

Para gravar o uso do totem com OBS, capture a tela ou janela do aplicativo. Nao inicie `OBS Virtual Camera` e nao adicione a webcam fisica como fonte no OBS enquanto o FanFrame Kiosk usa a webcam.

## Trocar O Pareamento

Use somente quando o administrador FanFrame enviar um novo codigo de instalacao.

1. Abra o modo tecnico com `Ctrl + Shift + F12`.
2. Digite o PIN tecnico.
3. Clique em `Reparear este totem`.
4. Confirme o repareamento.
5. Digite o novo codigo de instalacao.
6. Confira se a tela inicial aparece com o time correto.

Esse processo apaga apenas o pareamento local do PC. Times, precos, assets, prompt de IA e permissoes continuam controlados remotamente pelo painel.

## Quando Chamar Suporte

Informe o codigo de erro exibido:

- `NET-001`: internet indisponivel.
- `CAM-001`: camera nao encontrada.
- `PAY-001`: pagamento indisponivel.
- `CFG-001`: configuracao nao sincronizada.
- `IA-001`: geracao de imagem indisponivel.

Nao altere arquivos internos do aplicativo. As configuracoes do time, preco e IA sao controladas remotamente pelo administrador FanFrame.
