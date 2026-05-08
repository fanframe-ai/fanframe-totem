# Integração com Replicate - Virtual Try-On (FanFrame)

Este documento detalha como funciona a integração com a API do Replicate na plataforma multi-tenant **FanFrame** para gerar imagens de "provador virtual". Cada time (`teams.id`) pode ter o seu próprio `replicate_api_token` e `generation_prompt`, com fallback para o secret global `REPLICATE_API_TOKEN`.

---

## Visão Geral da Arquitetura

```
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│   Frontend   │ ──▶  │  Edge Function       │ ──▶  │  Replicate API   │
│  (React)     │      │  generate-tryon      │      │  (Seedream 4.5)  │
└──────────────┘      └──────────────────────┘      └────────┬─────────┘
       │                       │                              │
       │                       ▼                              │
       │              ┌──────────────────┐                    │
       │              │  generation_queue │                    │
       │              │  (Supabase)       │                    │
       │              └────────┬─────────┘                    │
       │                       │                              │
       ◀───────────────────────┤◀─────────────────────────────┘
     Realtime                  │                         Webhook
     Subscription              ▼                              
                      ┌──────────────────────┐
                      │  Edge Function       │
                      │  replicate-webhook   │
                      └──────────────────────┘
```

### Fluxo Resumido

1. **Frontend** (rota `/{slug}`) envia foto do usuário + camisa + fundo + `teamId` para `generate-tryon`
2. **generate-tryon** faz upload da foto para storage, resolve o token/prompt do time e chama Replicate com webhook
3. **Replicate** processa a imagem (30-60 segundos)
4. **replicate-webhook** recebe callback e atualiza `generation_queue` (com `team_id` associado)
5. **Frontend** recebe atualização via Supabase Realtime e exibe resultado

---

## Pré-requisitos

### 1. Conta no Replicate

1. Criar conta em [replicate.com](https://replicate.com)
2. Gerar um API Token em [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
3. Adicionar o token como secret no Supabase: `REPLICATE_API_TOKEN`

### 2. Storage Bucket no Supabase

Criar um bucket chamado `tryon-temp` para armazenar temporariamente as fotos dos usuários:

```sql
-- Criar bucket para imagens temporárias
INSERT INTO storage.buckets (id, name, public) VALUES ('tryon-temp', 'tryon-temp', true);

-- Política de upload (service_role pode fazer tudo)
CREATE POLICY "Service role can upload" ON storage.objects
FOR ALL USING (bucket_id = 'tryon-temp');

-- Política de leitura pública
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'tryon-temp');
```

### 3. Tabela de Fila

```sql
CREATE TABLE public.generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_image_url TEXT NOT NULL,
  shirt_asset_url TEXT NOT NULL,
  background_asset_url TEXT NOT NULL,
  shirt_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  replicate_prediction_id TEXT,
  result_image_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_generation_queue_status ON generation_queue(status);
CREATE INDEX idx_generation_queue_prediction ON generation_queue(replicate_prediction_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE generation_queue;

-- RLS
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura por id" ON generation_queue
FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON generation_queue
FOR ALL USING (auth.role() = 'service_role');
```

---

## Edge Function: generate-tryon

### Endpoint
```
POST /functions/v1/generate-tryon
```

### Payload de Entrada
```typescript
{
  userImageBase64: string;    // Foto do usuário em base64
  shirtAssetUrl: string;      // URL pública da camisa (PNG transparente)
  backgroundAssetUrl: string; // URL pública do cenário de fundo
  shirtId: string;            // ID da camisa para logs
  userId?: string;            // ID opcional do usuário
  teamId?: string;            // ID do time (multi-tenant) para resolver token/prompt
}
```

### Resposta de Sucesso
```typescript
{
  message: "Generation started",
  queueId: "uuid-da-fila",
  predictionId: "replicate-prediction-id",
  status: "processing",
  queuePosition: 1,
  estimatedWaitSeconds: 45,
  rateLimitRemaining: 24
}
```

### Lógica Principal

```typescript
// 1. Upload da foto do usuário para storage temporário
const userImageUrl = await uploadToStorage(supabase, userImageBase64, "user-photo.png", generationId);

// 2. Criar entrada na fila
await createQueueEntry(supabase, {
  id: generationId,
  user_id: userId,
  user_image_url: userImageUrl,
  shirt_asset_url: shirtAssetUrl,
  background_asset_url: backgroundAssetUrl,
  shirt_id: shirtId,
});

// 3. Chamar Replicate com webhook (NÃO faz polling!)
const response = await fetch("https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: {
      prompt: textPrompt,
      image_input: [userImageUrl, shirtAssetUrl, backgroundAssetUrl],
      size: "4K",
      aspect_ratio: "match_input_image",
      max_images: 1,
    },
    webhook: `${SUPABASE_URL}/functions/v1/replicate-webhook`,
    webhook_events_filter: ["completed"],
  }),
});

// 4. Salvar prediction ID e retornar imediatamente
const prediction = await response.json();
await updateQueueStatus(supabase, generationId, "processing", {
  replicate_prediction_id: prediction.id,
});

return new Response(JSON.stringify({
  queueId: generationId,
  predictionId: prediction.id,
  status: "processing",
}));
```

---

## Edge Function: replicate-webhook

### Endpoint
```
POST /functions/v1/replicate-webhook
```

Esta função recebe callbacks automáticos do Replicate quando a geração termina.

### Payload Recebido do Replicate
```typescript
{
  id: "replicate-prediction-id",
  status: "succeeded" | "failed" | "canceled",
  output: string[] | string,  // URLs das imagens geradas
  error: string | null
}
```

### Lógica Principal

```typescript
// 1. Parsear payload
const { id: predictionId, status, output, error } = await req.json();

// 2. Encontrar entrada na fila pelo prediction ID
const { data: queueEntry } = await supabase
  .from("generation_queue")
  .select("*")
  .eq("replicate_prediction_id", predictionId)
  .single();

// 3. Processar resultado
if (status === "succeeded") {
  const generatedImageUrl = Array.isArray(output) ? output[0] : output;
  
  await supabase
    .from("generation_queue")
    .update({
      status: "completed",
      result_image_url: generatedImageUrl,
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueEntry.id);
    
} else if (status === "failed") {
  await supabase
    .from("generation_queue")
    .update({
      status: "failed",
      error_message: error,
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueEntry.id);
}
```

---

## Frontend: Supabase Realtime

### Hook: useQueueSubscription

```typescript
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface QueueSubscriptionOptions {
  queueId: string;
  onCompleted: (imageUrl: string) => void;
  onFailed: (errorMessage: string) => void;
}

export function useQueueSubscription({
  queueId,
  onCompleted,
  onFailed,
}: QueueSubscriptionOptions) {
  useEffect(() => {
    if (!queueId) return;

    const channel = supabase
      .channel(`queue-${queueId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_queue",
          filter: `id=eq.${queueId}`,
        },
        (payload) => {
          const newData = payload.new;

          if (newData.status === "completed" && newData.result_image_url) {
            onCompleted(newData.result_image_url);
          } else if (newData.status === "failed") {
            onFailed(newData.error_message || "Erro desconhecido");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId, onCompleted, onFailed]);
}
```

### Uso no Componente

```tsx
const [queueId, setQueueId] = useState<string | null>(null);
const [generatedImage, setGeneratedImage] = useState<string | null>(null);

// Iniciar geração
const handleGenerate = async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-tryon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userImageBase64,
      shirtAssetUrl,
      backgroundAssetUrl,
      shirtId,
    }),
  });
  
  const { queueId } = await response.json();
  setQueueId(queueId); // Ativa subscription
};

// Subscription para receber resultado
useQueueSubscription({
  queueId: queueId || "",
  onCompleted: (imageUrl) => {
    setGeneratedImage(imageUrl);
    setQueueId(null); // Limpa subscription
  },
  onFailed: (error) => {
    toast.error(error);
    setQueueId(null);
  },
});
```

---

## Configuração das Edge Functions

### supabase/config.toml

```toml
[functions.generate-tryon]
verify_jwt = false

[functions.replicate-webhook]
verify_jwt = false
```

**IMPORTANTE**: Ambas funções precisam de `verify_jwt = false` porque:
- `generate-tryon`: recebe chamadas diretas do frontend (sem auth Supabase)
- `replicate-webhook`: recebe callbacks do Replicate (servidor externo)

---

## Modelo Replicate: bytedance/seedream-4.5

### URL da API
```
https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions
```

### Parâmetros de Entrada

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `prompt` | string | Descrição do que gerar |
| `image_input` | string[] | Array de URLs das imagens de referência |
| `size` | string | Resolução: "1K", "2K", "4K" |
| `aspect_ratio` | string | "1:1", "16:9", "match_input_image", etc |
| `max_images` | number | Quantidade de imagens a gerar |

### Prompt Utilizado

O prompt é resolvido em runtime a partir do time:

1. `teams.generation_prompt` (customizado pelo admin no painel `/admin/teams/{slug}`)
2. Fallback genérico (camisa + cenário + regras de preservação)

Exemplo (genérico):

```
Virtual try-on: Transform this person to wear the {team.name} jersey.

RULES:
- Preserve the person's face, body proportions and pose exactly
- Replace only the upper body clothing with the provided jersey
- Ensure realistic fabric folds and natural fit
- Place the person in the provided background scene
- Match lighting to the background environment
- Maintain photorealistic quality, 8K resolution, sharp focus
- Professional DSLR camera quality
```

---

## Recursos de Resiliência

### Rate Limiting

- **Limite**: 25 gerações por hora por usuário
- **Tabela**: `rate_limits`
- **Janela**: 1 hora (60 minutos)

```typescript
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_LIMIT_MAX = 25;
```

### Circuit Breaker

Protege contra falhas em cascata quando a API do Replicate está instável.

- **Threshold**: 5 falhas consecutivas
- **Recovery Time**: 2 minutos
- **Estados**: `closed` → `open` → `half-open` → `closed`

```typescript
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIME_MS = 2 * 60 * 1000; // 2 minutos
```

---

## Checklist para Novo Projeto

### 1. Secrets no Supabase
- [ ] `REPLICATE_API_TOKEN` — Token padrão (fallback) da API Replicate
- [ ] `REPLICATE_API_TOKEN` por time — opcional, configurável em `teams.replicate_api_token`

### 2. Banco de Dados
- [ ] Tabela `generation_queue`
- [ ] Tabela `rate_limits` (opcional, para rate limiting)
- [ ] Tabela `system_settings` (opcional, para circuit breaker)
- [ ] Tabela `system_alerts` (opcional, para alertas)
- [ ] Habilitar Realtime na tabela `generation_queue`

### 3. Storage
- [ ] Bucket `tryon-temp` com acesso público de leitura

### 4. Edge Functions
- [ ] `generate-tryon` com `verify_jwt = false`
- [ ] `replicate-webhook` com `verify_jwt = false`
- [ ] Deploy das funções

### 5. Frontend
- [ ] Hook `useQueueSubscription` para Realtime
- [ ] Componente de loading com posição na fila
- [ ] Tratamento de erros

### 6. Assets
- [ ] Camisas em PNG com fundo transparente
- [ ] Cenários de fundo em alta resolução
- [ ] URLs públicas acessíveis

---

## Troubleshooting

### Erro 401 no Replicate
- Verificar se `REPLICATE_API_TOKEN` está configurado
- Verificar se o token não expirou

### Webhook não recebe callback
- Verificar se a URL do webhook está correta: `${SUPABASE_URL}/functions/v1/replicate-webhook`
- Verificar logs da Edge Function no Supabase Dashboard
- Verificar se `verify_jwt = false` no config.toml

### Realtime não atualiza
- Verificar se a tabela está habilitada para Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE generation_queue`
- Verificar RLS policies permitem leitura
- Verificar logs do subscription no console do browser

### Imagem não gerada
- Verificar logs da Edge Function `generate-tryon`
- Verificar se as URLs das imagens são públicas e acessíveis
- Verificar se o bucket `tryon-temp` tem acesso público

---

## Referências

- [Replicate API Docs](https://replicate.com/docs)
- [Seedream 4.5 Model](https://replicate.com/bytedance/seedream-4.5)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
