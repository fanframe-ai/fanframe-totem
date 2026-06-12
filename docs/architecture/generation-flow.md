# Fluxo De Geracao IA

```mermaid
sequenceDiagram
  participant K as Kiosk
  participant G as generate-tryon
  participant R as Replicate
  participant W as replicate-webhook
  participant D as Database/Storage
  K->>G: foto, camisa, sessao e time
  G->>D: validar pagamento e configuracao
  G->>R: prompt e assets
  R-->>G: prediction id
  G-->>K: geracao enfileirada
  R->>W: resultado
  W->>D: salvar imagem e concluir fila
  D-->>K: status/resultado
```

## Arquivos

- Inicio e progresso: `src/pages/Kiosk.tsx`, `src/hooks/useQueueSubscription.ts`.
- Prompt/modelo: `supabase/functions/generate-tryon/index.ts`.
- Conclusao: `supabase/functions/replicate-webhook/index.ts`.

## Invariantes

- Cenario pode ser fixo e invisivel no frontend.
- Resultado atual usa proporcao configurada pelo produto.
- Regra de pessoas deve estar no prompt; nao aplicar recorte destrutivo no cliente.
- Webhook e polling nao podem concluir a mesma geracao duas vezes.

## Verificacao

Snapshots de payload/prompt e `npm run check:functions`; teste real consome Replicate e deve ser consciente.

