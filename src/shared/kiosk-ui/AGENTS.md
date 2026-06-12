# Kiosk UI Compartilhada

## Escopo

Componentes desta pasta sao usados no app Windows e no construtor visual do admin.

## Regras

- Nao criar implementacao visual separada no admin.
- Referencia principal: viewport vertical 1080x1920.
- Use dimensoes estaveis e evite layout shift.
- Animacoes devem usar `transform` e `opacity`, respeitar `prefers-reduced-motion` e nunca bloquear interacao.
- Cores, fontes, textos e assets devem vir das props/configuracao do time.
- Nao esconder overflow necessario para carrosseis, QR Code ou botoes de acao.

## Verificacao

```powershell
npm run test:kiosk-ui
npm run build
```

Validar visualmente Home, camisa, CPF, PIX, camera, geracao e resultado.

