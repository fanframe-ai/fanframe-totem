# Documentação do Projeto - FanFrame

## Visão Geral

O **FanFrame** é uma plataforma multi-tenant de provadores virtuais. Permite criar e gerenciar múltiplos times/clientes em uma única infraestrutura, onde cada time possui seu próprio provador virtual com camisas, cenários, branding e configurações independentes. Os usuários fazem upload de uma foto, escolhem uma camisa e um cenário, e a aplicação utiliza IA (Replicate) para gerar uma imagem realista vestindo a camisa escolhida.

### URLs

- **Produção**: https://franframe.vercel.app
- **Preview Lovable**: https://franframe.lovable.app

### Supabase

- **Project ID**: yxtglwbrdtwmxwrrhroy
- **URL**: https://yxtglwbrdtwmxwrrhroy.supabase.co

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React/Vite)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Rotas:                                                                     │
│  /              → Redireciona para /admin                                  │
│  /:slug         → Provador virtual do time (ex: /redbull, /saopaulo)       │
│  /admin/*       → Painel administrativo                                    │
│                                                                             │
│  src/                                                                       │
│  ├── pages/TeamProvador.tsx   → Carrega time pelo slug da URL              │
│  ├── pages/Index.tsx          → Wizard do provador virtual                 │
│  ├── contexts/TeamContext.tsx  → Context multi-tenant                       │
│  ├── components/wizard/       → Componentes do wizard                       │
│  ├── hooks/                   → Hooks customizados                          │
│  └── config/fanframe.ts       → Configuração do sistema FanFrame            │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  Supabase Edge       │  │  Supabase Database       │
│  Functions           │  │  (PostgreSQL)            │
├──────────────────────┤  ├──────────────────────────┤
│ • generate-tryon     │  │ • teams                  │
│ • replicate-webhook  │  │ • generation_queue       │
│ • health-check       │  │ • test_links             │
│ • create-first-admin │  │ • daily_stats / alerts   │
└──────────┬───────────┘  │ • user_roles, etc.       │
           ▼              └──────────────────────────┘
┌──────────────────────┐
│   Replicate API      │
│   (Virtual Try-On)   │
└──────────────────────┘
```

---

## Stack Tecnológica

### Frontend
- **React 18** + **TypeScript 5** — Framework UI
- **Vite 5** — Build tool
- **Tailwind CSS v3** — Estilização com design tokens semânticos
- **shadcn/ui** — Componentes UI
- **React Query** — Cache e estado do servidor
- **React Router DOM** — Navegação (SPA)
- **Lucide React** — Ícones

### Backend (Supabase)
- **PostgreSQL** — Banco de dados multi-tenant
- **Supabase Edge Functions (Deno)** — Funções serverless
- **Supabase Auth** — Autenticação (painel admin)
- **Row Level Security (RLS)** — Segurança de dados
- **Supabase Realtime** — Subscriptions para status de geração

### APIs Externas
- **Replicate API** — Geração de imagens (Virtual Try-On), token configurável por time

### Deploy
- **Vercel** — Hospedagem de produção com SPA rewrites
- **Lovable** — Ambiente de desenvolvimento e preview

---

## Multi-Tenancy

O sistema é multi-tenant. Cada time é uma linha na tabela `teams` com configurações isoladas:

| Configuração | Descrição |
|---|---|
| `slug` | Identificador na URL (ex: `redbull`, `saopaulo`) |
| `name` | Nome do time |
| `shirts` | JSON com camisas disponíveis |
| `backgrounds` | JSON com cenários de fundo |
| `replicate_api_token` | Token da API Replicate (próprio do time) |
| `generation_prompt` | Prompt customizado para IA |
| `primary_color` / `secondary_color` | Cores do branding |
| `logo_url` / `watermark_url` | Logo e marca d'água |
| `text_overrides` | Textos customizados da interface |
| `tutorial_assets` | Assets do tutorial |

### Fluxo de Acesso

```
1. Usuário acessa franframe.vercel.app/{slug}
2. TeamProvador.tsx busca o time pelo slug na tabela teams
3. TeamContext carrega todas as configurações do time
4. O provador virtual renderiza com branding e assets do time
```

---

## Fluxo do Usuário (Provador Virtual)

```
1. ACESSO
   └── Usuário acessa via franframe.vercel.app/{slug}
       ou via link de teste: franframe.vercel.app/{slug}?test_token=XXX

2. CRÉDITOS
   └── Validação do test_token na tabela test_links do Supabase
       (sem créditos = não pode gerar imagem)

3. WIZARD (6 etapas)
   ├── Welcome → Tela inicial com branding do time
   ├── Tutorial → Explicação do processo
   ├── Shirt Selection → Escolher camisa
   ├── Background Selection → Escolher cenário
   ├── Upload → Fazer upload da foto
   └── Result → Ver imagem gerada

4. GERAÇÃO (Arquitetura Assíncrona)
   ├── Débito de 1 crédito (test_links)
   ├── Chamada à Edge Function generate-tryon
   ├── Criação de job na fila (generation_queue)
   ├── Chamada assíncrona ao Replicate
   ├── Webhook recebe resultado
   └── Imagem retornada via Realtime subscription

5. RESULTADO
   ├── Aplicação de marca d'água (se configurada no time)
   ├── Download da imagem
   └── Compartilhamento (WhatsApp, Twitter)
```

---

## Links de Teste

O acesso ao provador é controlado por links de teste com créditos limitados armazenados no Supabase.

- Criados pelo painel admin em `/admin/teams/{slug}`
- Formato: `franframe.vercel.app/{slug}?test_token=XXX`
- Tabela: `test_links` (token, credits_total, credits_used, is_active, expires_at)
- Hook: `useTestToken.ts`

---

## Estrutura de Arquivos

```
src/
├── pages/
│   ├── TeamProvador.tsx         # Carrega time pelo slug e renderiza Index
│   ├── Index.tsx                # Wizard principal do provador
│   ├── NotFound.tsx             # Página 404
│   ├── TermosDeUso.tsx          # Termos de uso
│   ├── UploadAssets.tsx         # Upload de assets
│   └── admin/                   # Painel administrativo
│       ├── Dashboard.tsx
│       ├── Teams.tsx            # Lista de provadores/times
│       ├── TeamEdit.tsx         # Edição de time (assets, branding, prompts)
│       ├── Generations.tsx
│       ├── Stats.tsx
│       ├── Alerts.tsx
│       ├── SystemStatus.tsx
│       ├── Settings.tsx
│       └── Login.tsx
│
├── components/
│   ├── wizard/                  # Componentes do wizard
│   │   ├── WelcomeScreen.tsx
│   │   ├── TutorialScreen.tsx
│   │   ├── ShirtSelectionScreen.tsx
│   │   ├── BackgroundSelectionScreen.tsx
│   │   ├── UploadScreen.tsx
│   │   ├── ResultScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   ├── TestResultScreen.tsx
│   │   └── StepIndicator.tsx
│   │
│   ├── admin/                   # Componentes do admin
│   │   ├── AdminLayout.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── ProtectedAdminRoute.tsx
│   │   ├── GenerationsTable.tsx
│   │   ├── AlertsList.tsx
│   │   ├── StatsCard.tsx
│   │   ├── TeamSelector.tsx
│   │   ├── TestLinksManager.tsx
│   │   └── AssetCard.tsx
│   │
│   └── ui/                      # Componentes shadcn/ui
│
├── contexts/
│   └── TeamContext.tsx           # Context multi-tenant do time
│
├── hooks/
│   ├── useTestToken.ts          # Links de teste
│   ├── useQueueSubscription.ts  # Realtime para fila de geração
│   ├── useAdminAuth.ts          # Autenticação admin (Supabase Auth)
│   ├── useAdminStats.ts         # Estatísticas admin
│   ├── useConsentLog.ts         # Log de consentimento
│   ├── useGenerationHistory.ts  # Histórico de gerações
│   └── useAssetTextOverrides.ts # Overrides de texto do time
│
├── config/
│   └── fanframe.ts              # Constantes e configuração base
│
└── integrations/
    └── supabase/
        ├── client.ts            # Cliente Supabase
        └── types.ts             # Tipos do banco (auto-gerado)
```

---

## Edge Functions

### `generate-tryon`
Inicia a geração de imagem via Replicate.

```
POST /functions/v1/generate-tryon
Body: { userImageBase64, shirtAssetUrl, backgroundAssetUrl, shirtId, userId?, teamId? }
Response: { queueId, message, status }
```

### `replicate-webhook`
Recebe callbacks do Replicate quando a geração é concluída. Atualiza `generation_queue` e notifica via Realtime.

### `health-check`
Verifica status dos serviços.

### `create-first-admin`
Cria o primeiro usuário admin (requer `ACCESS_PASSWORD`).

---

## Banco de Dados

### Tabelas Principais

#### `teams`
Configuração de cada time/provador. Contém slug, assets (shirts/backgrounds como JSON), branding, tokens de API, prompts e URLs.

#### `generation_queue`
Fila de gerações assíncronas com status (pending → processing → completed/failed), referência ao time (`team_id`), URLs de assets e resultado.

#### `generations`
Registro de todas as gerações com métricas (tempo de processamento, status, erros).

#### `test_links`
Links de teste com créditos limitados, vinculados a um time.

#### `user_roles`
Controle de acesso ao painel admin (roles: `admin`, `super_admin`).

#### `system_alerts`
Alertas do sistema (error_spike, slow_processing, high_usage, api_error) com severidade e status de resolução.

#### `daily_stats`
Estatísticas diárias por time.

#### `consent_logs`
Registro de consentimento dos usuários.

#### `health_checks`
Registros de verificação de saúde dos serviços.

#### `system_settings`
Configurações globais do sistema (chave-valor).

---

## Painel Administrativo

Acessível em `/admin` com autenticação via Supabase Auth.

### Funcionalidades
- **Dashboard** — Visão geral com métricas e seletor de time
- **Provadores (Teams)** — CRUD de times com configuração visual de assets, branding e prompts
- **Gerações** — Tabela de todas as gerações com filtros
- **Estatísticas** — Gráficos e métricas por período
- **Status do Sistema** — Health checks dos serviços
- **Alertas** — Alertas ativos e histórico
- **Configurações** — Settings globais

### Acesso Admin
```
Email: admin@franframe.com
Senha: Admin123@
```

---

## Secrets e Variáveis

### Supabase Secrets
| Nome | Descrição |
|------|-----------|
| `REPLICATE_API_TOKEN` | Token padrão do Replicate (fallback se time não tiver próprio) |
| `ACCESS_PASSWORD` | Senha para criar primeiro admin |

### Frontend (.env)
```env
VITE_SUPABASE_PROJECT_ID="yxtglwbrdtwmxwrrhroy"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."
VITE_SUPABASE_URL="https://yxtglwbrdtwmxwrrhroy.supabase.co"
```

---

## Deploy (Vercel)

O arquivo `vercel.json` configura SPA rewrites para que todas as rotas sejam tratadas pelo React Router:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Troubleshooting

### Erro 404 na Vercel
**Causa**: Rota do React Router não reconhecida pelo servidor.
**Solução**: Verificar se `vercel.json` tem o rewrite configurado.

### Sem créditos
**Causa**: Sem `test_token` válido ou créditos do link esgotados.
**Solução**: Solicitar novo link de teste no painel admin.

### Download abre link em vez de baixar
**Causa**: CORS ou fallback incorreto.
**Solução**: O sistema usa fetch → blob → createObjectURL → anchor.download para garantir download direto.

### Marca d'água aparecendo sem configuração
**Causa**: Campo `watermark_url` preenchido no time.
**Solução**: Limpar o campo de marca d'água no branding do time via painel admin.

---

## Changelog

### v2.2.0 (Maio 2026)
- Removida integração WordPress/FanFrame-proxy
- Acesso ao provador apenas via test_links (sem login de usuário final)
- Removidas colunas `wordpress_api_base` e `purchase_urls` da tabela teams

### v2.1.0 (Maio 2026)
- Documentação reorganizada (DOCUMENTATION, replicate-integration, design-system)
- Refresh do design system com tokens semânticos consolidados
- Branding dinâmico por time aplicado via CSS custom properties (`--primary-color`, `--secondary-color`)

### v2.0.0 (Abril 2026)
- Migração para plataforma multi-tenant FanFrame
- Roteamento por slug (`/{slug}`)
- Configuração isolada por time (branding, assets, prompts, tokens)
- Sistema de links de teste com créditos independentes
- Deploy na Vercel (franframe.vercel.app)
- Painel admin unificado com gerenciamento visual de times
- Download robusto com fallback blob

### v1.1.0 (Fevereiro 2026)
- Migração para Replicate API
- Arquitetura assíncrona com webhooks
- Sistema de fila (generation_queue)
- Realtime subscriptions para status

### v1.0.0 (Janeiro 2026)
- Lançamento inicial (Provador Tricolor Virtual)
- Painel administrativo
- 4 cenários de fundo, 3 camisas
