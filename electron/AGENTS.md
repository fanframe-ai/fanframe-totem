# Electron Windows Kiosk

## Escopo

Janela, atalhos tecnicos, persistencia local, atualizacao e integracoes do PC Windows.

## Regras

- Nao quebrar fullscreen/kiosk nem o acesso tecnico protegido.
- Persistir somente configuracao tecnica; nao persistir foto, CPF ou segredo de pagamento.
- Atualizacao deve apontar para release publicada e preservar vinculacao/configuracao local.
- IPC deve expor apenas operacoes necessarias e validar argumentos.
- Mudanca em `main.cjs`, preload ou updater exige testes Electron e build Windows quando aplicavel.

## Verificacao

```powershell
npm run check:electron
npm run release:kiosk:verify
```

