# Modelo De Dados Operacional

## Entidades Principais

- `teams`: branding, preco, textos, assets e configuracao publicada.
- `kiosk_devices`: equipamento, time vinculado, segredo, versao, status e ultimo contato.
- `kiosk_sessions`: jornada de uma venda no equipamento.
- `kiosk_payments`: pedido, metodo, valor, status e referencia PagBank.
- `generation_queue`: trabalho de IA e estado operacional.
- `generations`: resultado final persistido.
- `system_alerts`: problemas operacionais.
- `user_roles`: autorizacao do painel.

## Regras

- Migrations sao append-only.
- RLS separa acesso anonimo, dispositivo autenticado, operador e super admin.
- Consultas do dashboard devem preferir views/RPCs para agregacoes pesadas.
- CPF e dado pessoal; evitar retorno para clientes que nao necessitam dele.
- Relacoes de sessao, pagamento e geracao devem permitir auditoria do fluxo completo.

## Onde Confirmar

- Schema real: `supabase/migrations/`.
- Tipos gerados: `src/integrations/supabase/types.ts`.
- Tipos do admin podem ser locais, mas devem acompanhar migrations.

## Verificacao

Revisar migration, RLS e indices; depois executar `npm run check:functions` e checks dos clientes afetados.

