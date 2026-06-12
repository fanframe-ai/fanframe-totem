# Supabase Backend

## Escopo

- Schema e RLS: `migrations/`.
- HTTP/backend: `functions/`.
- Codigo compartilhado permitido: `functions/_shared/`.

## Regras

- Nunca editar migration ja aplicada; crie uma nova migration.
- Toda tabela com dados de usuario, pagamento ou dispositivo precisa de RLS explicita.
- Edge Functions devem validar auth, metodo HTTP e payload antes de acessar dados.
- Respostas de erro nao podem expor token, CPF completo, stack ou resposta bruta de provedor.
- Secrets existem somente no ambiente Supabase.
- PagBank e Replicate devem possuir timeout e erro operacional rastreavel.
- Deploy nao faz parte de `check:functions`; deploy e etapa separada e consciente.

## Verificacao

```powershell
npm run check:functions
```

Ao alterar schema, revisar policies, indexes e compatibilidade com tipos/clientes existentes.

