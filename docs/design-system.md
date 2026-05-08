# Design System - FanFrame

Documento de referência do design system da plataforma **FanFrame**. Toda a estilização do projeto é baseada em tokens semânticos definidos em `src/index.css` e expostos para o Tailwind via `tailwind.config.ts`. Componentes nunca devem usar cores diretas (`bg-white`, `text-black`, `#fff`) — sempre tokens.

---

## 1. Princípios

- **Dark Premium First** — tema escuro como base, com glassmorphism e acentos brancos.
- **Tokens semânticos** — toda cor é HSL, definida em `:root` e consumida via `hsl(var(--token))`.
- **Branding dinâmico por time** — cada time injeta `primary_color` e `secondary_color` em runtime sobre os tokens base (CTAs, StepIndicator, badges, seleções).
- **Mobile-first** — alvos de toque mínimos de 44×44px, safe areas para notch, fontes ≥16px em inputs (evita zoom no iOS).
- **Reduced motion** — todas as animações respeitam `prefers-reduced-motion`.

---

## 2. Tokens de Cor

Todos os valores são em **HSL** (sem `hsl()` no token, apenas no consumo). Definidos em `src/index.css`.

### Core

| Token | Valor | Uso |
|---|---|---|
| `--background` | `0 0% 0%` | Fundo da página |
| `--foreground` | `0 0% 100%` | Texto principal |
| `--card` | `0 0% 7%` | Fundo de cards |
| `--card-foreground` | `0 0% 100%` | Texto sobre cards |
| `--popover` | `0 0% 7%` | Popovers / dropdowns |
| `--popover-foreground` | `0 0% 100%` | Texto em popovers |

### Brand & States

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `0 0% 100%` | CTAs, links, botões primários (override por time) |
| `--primary-foreground` | `0 0% 0%` | Texto sobre primary |
| `--secondary` | `0 0% 13%` | Botões/áreas secundárias |
| `--secondary-foreground` | `0 0% 100%` | Texto sobre secondary |
| `--muted` | `0 0% 15%` | Áreas neutras |
| `--muted-foreground` | `0 0% 55%` | Texto auxiliar |
| `--accent` | `0 0% 20%` | Hover/realce sutil |
| `--accent-foreground` | `0 0% 100%` | Texto sobre accent |

### Feedback

| Token | Valor | Uso |
|---|---|---|
| `--success` | `142 76% 36%` | Sucesso, status operacional |
| `--warning` | `45 93% 47%` | Avisos |
| `--destructive` | `0 84% 60%` | Erros, ações destrutivas |
| `--success-foreground` / `--warning-foreground` / `--destructive-foreground` | — | Texto sobre o respectivo |

### Estrutura

| Token | Valor | Uso |
|---|---|---|
| `--border` | `0 0% 20%` | Bordas |
| `--input` | `0 0% 15%` | Fundo de inputs |
| `--ring` | `0 0% 100%` | Anel de foco |
| `--radius` | `0.75rem` | Raio base (`lg`); `md` = -2px; `sm` = -4px |

### Sidebar (Admin)

| Token | Valor |
|---|---|
| `--sidebar-background` | `0 0% 5%` |
| `--sidebar-foreground` | `0 0% 100%` |
| `--sidebar-primary` | `0 0% 100%` |
| `--sidebar-accent` | `0 0% 15%` |
| `--sidebar-border` | `0 0% 20%` |
| `--sidebar-ring` | `0 0% 100%` |

### Glass / Acentos

| Token | Valor | Uso |
|---|---|---|
| `--glass` | `0 0% 100% / 0.05` | Fundo glass |
| `--glass-border` | `0 0% 100% / 0.1` | Borda glass |
| `--glass-hover` | `0 0% 100% / 0.1` | Hover glass |
| `--spfc-red` | `0 84% 47%` | Acento legacy SPFC |
| `--spfc-black` | `0 0% 10%` | Acento legacy SPFC |

---

## 3. Branding Dinâmico (Multi-tenant)

Cada time na tabela `teams` possui `primary_color` e `secondary_color` (formato HEX). Esses valores são aplicados em runtime sobre os tokens base, sobrescrevendo o branding em:

- Botões principais (CTAs)
- `StepIndicator` (barra de progresso)
- Badges de status
- Indicadores de card selecionado
- Bordas/realces de hover

Padrão de aplicação (inline style):

```tsx
const { team } = useTeam();

<Button style={{ backgroundColor: team?.primary_color, color: team?.secondary_color }}>
  CTA
</Button>
```

> **Regra**: nunca hardcode cores em componentes. Use tokens semânticos para o tema base e `team.primary_color` / `team.secondary_color` apenas onde o branding do time deve aparecer.

---

## 4. Tipografia

- **Família**: `Inter` (Google Fonts), pesos 400/500/600/700/800/900.
- **Fallback**: `system-ui, sans-serif`.
- **Headings (`h1–h6`)**: `font-bold uppercase tracking-tight`.
- **Body**: 16px base, antialiased.
- **Inputs**: forçados a 16px (impede zoom no iOS).

Escala recomendada (Tailwind):

| Uso | Classe |
|---|---|
| Display | `text-4xl md:text-6xl font-black` |
| H1 | `text-3xl md:text-5xl font-bold` |
| H2 | `text-2xl md:text-4xl font-bold` |
| H3 | `text-xl md:text-2xl font-bold` |
| Body | `text-base` |
| Small | `text-sm text-muted-foreground` |
| Micro | `text-xs uppercase tracking-wide` |

---

## 5. Espaçamento, Radius e Container

- **Container**: centralizado, padding `1rem`, breakpoint `2xl: 1400px`.
- **Radius**: `--radius: 0.75rem` (`rounded-lg`), variantes `md` e `sm`.
- **Spacing**: escala padrão Tailwind (`4px` base).

---

## 6. Breakpoints

Padrão Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1400`.

---

## 7. Classes Utilitárias Customizadas

Definidas em `@layer components` e `@layer utilities` em `src/index.css`.

### Componentes

| Classe | Descrição |
|---|---|
| `.glass-card` | Card glassmorphism (`bg-card/50 backdrop-blur-xl border border-white/10 rounded-xl`) |
| `.glass-card-selected` | Variante selecionada com borda branca dupla |
| `.gradient-text` | Texto com gradiente branco |
| `.glow-pulse` | Glow pulsante (animação 2s) |
| `.shimmer` | Loading shimmer |
| `.touch-target` | Min 44×44px (alvo de toque) |
| `.touch-active` | `active:scale-95 active:opacity-80` |
| `.btn-mobile` | Botão mobile (52px alt., uppercase, bold) |
| `.btn-mobile-cta` | CTA mobile (56px alt., maior) |

### Safe Area (notch / iOS)

`.safe-top`, `.safe-bottom`, `.safe-left`, `.safe-right`, `.safe-x`, `.safe-y`, `.safe-all`, `.fixed-bottom-safe`, `.fixed-top-safe`.

### Outros

- `.no-scrollbar` — esconde scrollbar mantendo scroll.

---

## 8. Animações

| Nome | Duração | Uso |
|---|---|---|
| `glow-pulse` | 2s infinite | Destaque de elementos |
| `shimmer` | 1.5s infinite | Skeleton loading |
| `fade-in` | 0.5s | Entrada de tela/conteúdo |
| `scale-in` | 0.3s | Modais, cards |
| `spin-slow` | 2s linear infinite | Loaders |
| `bounce-x` | — | Setas/CTAs |
| `accordion-down/up` | 0.2s | Radix Accordion |

Todas respeitam `prefers-reduced-motion: reduce` (duração reduzida a 0.01ms).

---

## 9. Componentes Base (shadcn/ui)

Todos os componentes UI residem em `src/components/ui/`, configurados via `components.json` (style: `default`, baseColor: `slate`, CSS variables: ON).

Customize variantes com `cva` em vez de sobrescrever cores diretamente:

```tsx
const buttonVariants = cva("...", {
  variants: {
    variant: {
      premium: "bg-gradient-to-r from-primary to-primary/70 text-primary-foreground",
    },
  },
});
```

---

## 10. Regras de Ouro

1. **Nunca** use cores literais (`text-white`, `bg-black`, `#fff`, `rgb(...)`) em componentes.
2. **Sempre** consuma tokens via Tailwind (`bg-primary`, `text-muted-foreground`) ou `hsl(var(--token))` em CSS.
3. **Branding por time** apenas via `team.primary_color` / `team.secondary_color` em pontos de marca.
4. **Headings** seguem o padrão global (`font-bold uppercase tracking-tight`) — não sobrescreva sem motivo.
5. **Mobile**: respeite `touch-target` e `safe-*` em telas críticas.
6. **Animações**: prefira as utilitárias existentes a criar novas.
7. **Contraste**: garanta AA tanto no tema base quanto com cores de time aplicadas.

---

## 11. Referências

- `src/index.css` — tokens, layers, animações
- `tailwind.config.ts` — mapeamento de tokens para classes Tailwind
- `src/contexts/TeamContext.tsx` — fonte do branding por time
- `components.json` — config shadcn/ui