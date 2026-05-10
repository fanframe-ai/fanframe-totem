# Release Windows Do FanFrame Kiosk

Este guia e para gerar e instalar o software dedicado do totem em PCs Windows.

## Gerar Instalador

No computador de desenvolvimento:

```powershell
npm install
npm run build
npm run dist:win
```

Saidas esperadas:

- `release/FanFrame Kiosk Setup *.exe`: instalador para o dono do totem.
- `release/FanFrame Kiosk *.exe`: versao portable para teste rapido.

Para validar sem gerar instalador completo:

```powershell
npm run dist:win:dir
```

## Antes De Enviar Ao Dono Do Totem

1. No painel admin, crie ou atualize o time.
2. Cadastre o totem com cidade, ponto, local, responsavel e versao esperada.
3. Clique em `Codigo`.
4. Copie a mensagem de instalacao gerada pelo painel.
5. Envie a mensagem e o instalador ao dono do totem.

## Instalar No PC Windows Do Totem

1. Instale o `FanFrame Kiosk Setup`.
2. Abra o app.
3. Digite o codigo de instalacao recebido.
4. Aguarde a tela inicial do time.
5. Abra o modo tecnico com `Ctrl + Shift + F12`.
6. Digite o PIN tecnico e teste internet, camera e diagnostico.

## Operacao Remota

O painel mostra:

- ultima versao reportada pelo app;
- versao esperada configurada no cadastro do totem;
- status online/offline;
- erros recentes;
- pareamento;
- comandos pendentes;
- alertas operacionais detectados.

Quando a versao instalada estiver diferente da versao esperada, o painel marca o totem como desatualizado. A atualizacao ainda e feita instalando uma nova versao do app no PC Windows; o painel controla o alvo e mostra quais totens precisam dessa manutencao.

## Limites Atuais

- Atualizacao automatica silenciosa ainda nao esta implementada.
- Pagamento por cartao depende do SDK/ambiente PlugPag instalado e homologado no PC Windows.
- Sem internet, o totem nao vende porque depende de Supabase, PagBank e IA.
