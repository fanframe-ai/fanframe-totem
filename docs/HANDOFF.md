# FanFrame Totem Developer Handoff

This is the first document to read when taking over the FanFrame Totem project.

## Current Production State

| Surface | Value |
| --- | --- |
| GitHub repo | `fanframe-ai/fanframe-totem` |
| Admin web | `https://fanframe-totem.vercel.app/` |
| Kiosk web/test | `https://fanframe-kiosk-web.vercel.app/` |
| Supabase project ref | `dzfbjscrpxhpyeimggut` |
| Current Windows kiosk release | `v0.3.28` |
| Real payment provider | PagBank PIX |
| Test payment rule | Simulated/test payment must not count as real sales |
| Production kiosk note | Dedicated Windows kiosk app for physical totens |

## What This System Does

FanFrame Totem runs paid AI photo generation on physical Windows kiosks. A user chooses a shirt, pays by PIX, takes a photo, waits for generation, and receives a QR/download link. Admin users manage teams, shirts, pricing, kiosk devices, sales, links for online kiosk testing, and operational health.

## Repo Map

| Path | Responsibility |
| --- | --- |
| `src/pages/Kiosk.tsx` | Main kiosk runtime flow |
| `src/shared/kiosk-ui/` | Shared visual components used by kiosk and admin preview |
| `src/lib/kiosk.ts` | Kiosk helpers, device auth headers, recovery helpers, friendly errors |
| `electron/` | Windows kiosk shell, updater, packaging-sensitive code |
| `apps/admin/` | Official Vercel admin panel |
| `supabase/functions/` | Edge Functions for generation, payment, recovery, auth, health, commands |
| `supabase/migrations/` | Database schema and RLS history |
| `scripts/` | Release, deploy, context, and verification scripts |
| `docs/architecture/` | Flow-specific architecture maps |

## First Day Setup

1. Clone the repo.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill only publishable frontend values.
4. Read `AGENTS.md`.
5. Read `docs/architecture/INDEX.md`.
6. Run `npm run check:affected`.
7. Run the app surfaces you need:
   - Kiosk/web shell: `npm run dev`
   - Admin: `npm run admin:dev`
   - Electron dev shell: start Vite, then `npm run electron:dev`

## Read This Before Changing Anything

- Payment confirmed by PagBank must never be lost due to timeout, refresh, app crash, or screen transition.
- Test payments are test-only and must not be counted as real sales.
- Do not add new features to the legacy admin under `src/pages/admin`; use `apps/admin`.
- Do not expose Supabase service-role keys, PagBank tokens, GitHub tokens, Replicate tokens, device secrets, CPF values, or customer images in logs/docs/frontend.
- If Windows kiosk code changes, generate and verify a Windows release.
- If Edge Functions change, deploy them intentionally; local checks do not deploy functions.
- If schema changes, create a new migration; never edit an already-applied migration.

## Common Change Routes

| Task | Start Here | Required Checks |
| --- | --- | --- |
| Kiosk screen or flow | `docs/architecture/kiosk-flow.md` | `npm run check:kiosk` |
| Payment/PagBank/CPF | `docs/architecture/payment-flow.md` | `npm run check:functions && npm run check:kiosk` |
| AI generation/Replicate | `docs/architecture/generation-flow.md` | `npm run check:functions` |
| Admin panel | `docs/architecture/admin-publish-flow.md` | `npm run check:admin` |
| Download/QR delivery | `docs/architecture/delivery-flow.md` | `npm run check:functions && npm run check:admin` |
| Schema/RLS | `docs/architecture/data-model.md` | `npm run check:functions` |
| Windows release | `docs/release-automation.md` | `npm run check:electron` and `npm run release:kiosk:verify` |

## Recent Critical Fix Context

In June 2026 a real PIX session on `TOTEM - MUSEU FLAMENGO` reached payment but failed before durable generation queue creation. The fix in release `v0.3.28` makes generation start failures persistent, classifies them as recoverable IA errors, surfaces paid-without-generation issues in admin, and allows retry without charging again.

When investigating similar issues, correlate:

- `kiosk_sessions.id`
- `kiosk_payments.session_id`
- `kiosk_payments.status`
- `kiosk_sessions.generation_queue_id`
- `generation_queue.id`
- `kiosk_device_events`
- Edge Function logs for `generate-tryon`, `recover-kiosk-photos`, and `mark-kiosk-session-error`

## Where To Continue

- Development setup: `docs/DEVELOPMENT.md`
- Production operations: `docs/OPERATIONS.md`
- Access checklist: `docs/ACCESS.md`
- New developer checklist: `docs/ONBOARDING_CHECKLIST.md`
- Documentation map: `docs/DOCS_INDEX.md`
