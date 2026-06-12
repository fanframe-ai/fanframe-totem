# Admin Remoto

## Escopo

`apps/admin` e o unico painel oficial. Nao use nem atualize `src/pages/admin`.

## Entradas

- Router e paginas atuais: `src/App.tsx`.
- Cliente e tipos: `src/lib/`.
- Estilos: `src/styles.css`.
- Preview real: componentes importados de `../../src/shared/kiosk-ui/`.

## Regras

- Texto de operacao deve estar em portugues simples.
- `super_admin` gerencia usuarios; operadores de visualizacao nao podem mutar dados.
- Nunca mostrar secrets de PagBank, Replicate ou Supabase.
- Edicao de time cria rascunho; publicacao e a fronteira para atualizar o kiosk.
- Preview e kiosk devem compartilhar componentes, props e CSS; nao simular a tela com markup paralelo.
- Queries e mutations devem ficar proximas da feature quando forem extraidas.

## Verificacao

```powershell
npm run check:admin
```

Para alteracao somente visual, execute tambem verificacao no navegador no viewport do painel e no preview vertical.

