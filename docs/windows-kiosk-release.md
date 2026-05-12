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
3. Clique em `Instalar`.
4. Copie a mensagem de instalacao gerada pelo painel.
5. Envie a mensagem e o instalador ao dono do totem.

## Instalar No PC Windows Do Totem

1. Instale o `FanFrame Kiosk Setup`.
2. Abra o app.
3. Digite o codigo de instalacao recebido.
4. Aguarde a tela inicial do time.
5. Abra o modo tecnico com `Ctrl + Shift + F12`.
6. Digite o PIN tecnico e teste internet, camera e diagnostico.

## Comportamento Kiosk No Windows

Em builds instalados, o app inicia junto com o Windows por padrao e abre em tela cheia vertical. O modo kiosk tambem bloqueia atalhos comuns de fuga, como `Alt + F4`, `Alt + Tab`, `Ctrl + R`, `F5`, `F11` e `F12`. O atalho tecnico `Ctrl + Shift + F12` continua disponivel para suporte local.

Para manutencao avancada no PC, use `kiosk.config.json`:

```json
{
  "autoLaunch": false,
  "blockShortcuts": false,
  "fullscreen": false,
  "kiosk": false,
  "updates": {
    "installerUrl": "https://seu-dominio.com/FanFrame-Kiosk-Setup.exe"
  }
}
```

Reative essas opcoes antes de devolver o PC para operacao no totem.

## Atualizar Pelo Proprio App

O modo tecnico tem o botao `Atualizar app`. Ele nao atualiza no meio da venda: o dono do totem precisa abrir o modo tecnico com `Ctrl + Shift + F12`, digitar o PIN e apertar o botao.

Configure uma das opcoes abaixo no `kiosk.config.json` do PC ou por variaveis de ambiente:

- `updates.installerUrl` ou `FANFRAME_UPDATE_URL`: baixa o instalador novo e abre no Windows.
- `updates.installerPath` ou `FANFRAME_UPDATE_PATH`: abre um instalador ja salvo no PC.
- `updates.updateCommand` ou `FANFRAME_UPDATE_COMMAND`: executa um comando local de atualizacao. Use `updates.updateArgs` quando precisar passar argumentos.

Depois de abrir o instalador, o FanFrame fecha automaticamente para a atualizacao continuar. PCs que ainda nao tem essa versao instalada precisam de uma ultima atualizacao manual para receber o botao.

## Operacao Remota

O painel mostra:

- ultima versao reportada pelo app;
- versao esperada configurada no cadastro do totem;
- status online/offline;
- erros recentes;
- pareamento;
- comandos pendentes;
- alertas operacionais detectados.

Quando a versao instalada estiver diferente da versao esperada, o painel marca o totem como desatualizado. A atualizacao pode ser iniciada pelo botao `Atualizar app` no modo tecnico, desde que o PC tenha um instalador ou link de instalador configurado.

## Limites Atuais

- Atualizacao silenciosa sem interacao do Windows ainda nao esta implementada.
- Enquanto a API PagBank nao estiver liberada, use `simulatePayments` apenas em laboratorio.
- Pagamento por cartao depende do SDK/ambiente PlugPag instalado e homologado no PC Windows.
- Sem internet, o totem nao vende porque depende de Supabase, PagBank e IA.
