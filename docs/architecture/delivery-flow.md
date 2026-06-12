# Entrega E Recuperacao

## Entrega Normal

`create-delivery-link` emite token temporario. O QR aponta para a pagina publica no dominio FanFrame, que resolve o token, mostra a imagem e oferece download/compartilhamento.

## Recuperacao Por CPF

O kiosk envia CPF completo com autenticacao do dispositivo para `recover-kiosk-photos`. A funcao limita tentativas, filtra pelo mesmo equipamento e retorna fotos recentes sem revelar CPF armazenado.

## Arquivos

- QR e resultado: `src/pages/Kiosk.tsx`, `src/shared/kiosk-ui/`.
- Link: `supabase/functions/create-delivery-link/index.ts`.
- Recuperacao: `supabase/functions/recover-kiosk-photos/index.ts`.
- Pagina publica: rota de entrega no `apps/admin`.

## Invariantes

- Token expira e nao permite listar outras fotos.
- Download deve usar nome amigavel e nao redirecionar o usuario para HTML bruto do Supabase.
- Recuperacao nao exige PIN, mas possui limite de tentativas e escopo por dispositivo.
- Consentimento para redes sociais e separado do download.

## Verificacao

`npm run check:admin`, `npm run check:functions` e teste mobile da pagina publica.

