# Automacao de release do FanFrame Kiosk

Este projeto tem duas entregas diferentes:

- Painel web: deploy pela Vercel a partir do GitHub.
- App Windows do totem: release GitHub com instalador `.exe` e arquivos de atualizacao.

## Release do app Windows

Use este comando para validar o que sera executado, sem alterar arquivos nem publicar:

```powershell
npm run release:kiosk:dry
```

Use este comando para gerar uma nova versao patch, testar, empacotar, commitar, enviar para o GitHub e publicar a release:

```powershell
npm run release:kiosk
```

O script executa:

1. incrementa a versao patch do `package.json`;
2. roda `npm test`;
3. roda `npm run lint`;
4. roda `npm --prefix apps/admin run build`;
5. roda `npm run dist:win`;
6. cria `FanFrame-Kiosk-Setup-latest.exe`;
7. cria os aliases com hifen usados pela atualizacao;
8. commita o bump de versao;
9. envia para `origin/main`;
10. cria a release no GitHub com os assets necessarios.

## Verificar uma release local

Depois de gerar uma release, valide os arquivos locais:

```powershell
npm run release:kiosk:verify
```

Esse comando verifica se existem:

- instalador NSIS;
- blockmap;
- portable;
- `FanFrame-Kiosk-Setup-latest.exe`;
- aliases versionados com hifen;
- `latest.yml` apontando para a versao atual.

## Quando precisa gerar app novo

Gere app novo quando mudar:

- codigo do totem;
- fluxo de telas;
- integracao local do Windows;
- camera;
- atualizador;
- bibliotecas do app.

Nao precisa gerar app novo quando mudar apenas configuracao remota:

- preco;
- textos;
- logo;
- imagens;
- video;
- camisas;
- cenario fixo;
- prompts;
- habilitar/desabilitar filtros.

Nesses casos, publique a configuracao no painel e use o comando remoto de atualizacao/sincronizacao do totem.
