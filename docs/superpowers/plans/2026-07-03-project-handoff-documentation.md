# Project Handoff Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository self-explanatory enough that a new developer can receive only the GitHub URL, clone the project, understand the production surfaces, run the apps, make safe changes, deploy backend/frontend, and release the Windows kiosk without relying on old Codex threads.

**Architecture:** Add one canonical handoff entry point and split supporting documentation by responsibility: development setup, operations/runbooks, architecture map, access matrix, and onboarding checklist. Keep existing domain docs, but add a status index that tells the next developer which docs are canonical, which are historical, and where to start for each type of task.

**Tech Stack:** React 18, Vite, Electron Windows kiosk, Supabase Postgres/Edge Functions, PagBank PIX, Replicate, Vercel admin/kiosk web, GitHub Releases.

---

## Current Documentation Findings

- `README.md` is concise and useful, but it does not yet give a complete handoff path for a new developer.
- `AGENTS.md` is the best Codex-facing rulebook and should point to the handoff entry point.
- `docs/architecture/INDEX.md` already works as a context router and should remain the architecture router.
- `docs/DOCUMENTATION.md` appears older and contains mojibake/encoding artifacts plus legacy production URLs; do not delete it in this pass, but mark it as historical from the new docs index.
- Release and operation docs exist, especially `docs/release-automation.md`, `docs/kiosk-totem.md`, `docs/go-live-checklist.md`, and `docs/windows-kiosk-release.md`; the new handoff should link to them rather than duplicate every detail.
- Recent production state that must be captured: admin web `https://fanframe-totem.vercel.app/`, kiosk web/test `https://fanframe-kiosk-web.vercel.app/`, Supabase project ref `dzfbjscrpxhpyeimggut`, current kiosk release `v0.3.28`, real payment provider PagBank PIX, simulated payments only for tests.

## Target File Structure

Create and modify these files:

- Create `docs/HANDOFF.md`: canonical entry point for a new developer; contains current state, repository map, first-day workflow, production links, deployment surfaces, non-negotiable rules, and next docs to read.
- Create `docs/DEVELOPMENT.md`: local setup, env vars, app commands, test matrix, Supabase CLI usage, Codex workflow, and safe debugging practices.
- Create `docs/OPERATIONS.md`: production operations runbook for kiosk/admin/Supabase/Vercel/GitHub releases, including incident triage for paid sessions without generation.
- Create `docs/ACCESS.md`: access matrix listing which systems require credentials, what scopes are needed, and what must never be committed. This file must not contain secrets.
- Create `docs/ONBOARDING_CHECKLIST.md`: checklist for a new developer to confirm they can run, test, inspect Supabase, deploy functions, and release the kiosk.
- Create `docs/DOCS_INDEX.md`: canonical documentation inventory with status labels: canonical, operational, architecture, historical.
- Modify `README.md`: make it a short GitHub landing page that points first to `docs/HANDOFF.md`.
- Modify `AGENTS.md`: add a "Handoff First" rule so future Codex sessions start from `docs/HANDOFF.md` and `docs/architecture/INDEX.md`.
- Modify `docs/architecture/INDEX.md`: add links to the new handoff/development/operations docs and retain its task router.
- Modify `docs/release-automation.md`: add a short "Release Ownership" section that points to the new operations doc and states that Windows kiosk code changes require GitHub Release assets.

## Task 1: Create The Canonical Handoff Entry Point

**Files:**
- Create: `docs/HANDOFF.md`

- [ ] **Step 1: Create the handoff document**

Create `docs/HANDOFF.md` with this exact structure:

```markdown
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
```

- [ ] **Step 2: Verify the document exists**

Run:

```powershell
Test-Path docs/HANDOFF.md
```

Expected output:

```text
True
```

- [ ] **Step 3: Commit Task 1**

Run:

```powershell
git add docs/HANDOFF.md
git commit -m "docs: add developer handoff guide"
```

Expected: commit succeeds.

## Task 2: Create The Development Guide

**Files:**
- Create: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Create the development document**

Create `docs/DEVELOPMENT.md` with this content:

```markdown
# FanFrame Totem Development Guide

## Required Tools

- Node.js compatible with the lockfile in this repository.
- npm.
- PowerShell on Windows for release scripts.
- Supabase CLI through `npx supabase`.
- Git Credential Manager for GitHub pushes/releases.

## Install

```powershell
npm install
```

## Environment Files

Create `.env` from `.env.example`.

Frontend values are publishable:

```env
VITE_SUPABASE_PROJECT_ID="dzfbjscrpxhpyeimggut"
VITE_SUPABASE_URL="https://dzfbjscrpxhpyeimggut.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="publishable-key-from-supabase"
```

Do not commit `.env`, `kiosk.config.json`, Supabase service-role keys, PagBank tokens, Replicate tokens, GitHub tokens, or device secrets.

## Run Locally

| Surface | Command | URL |
| --- | --- | --- |
| Kiosk/web shell | `npm run dev` | Vite output, usually `http://127.0.0.1:5173/` |
| Admin | `npm run admin:dev` | `http://127.0.0.1:5174/` |
| Electron kiosk dev | `npm run dev`, then `npm run electron:dev` | Electron window |

## Checks

Use the smallest check that proves the change:

```powershell
npm run check:affected
npm run check:kiosk
npm run check:admin
npm run check:electron
npm run check:functions
npm run check:all
npm run context:check
```

Run `npm run check:all` before releases or broad cross-domain changes.

## Test Strategy

- Kiosk flow changes need tests under `src/` or architecture tests under `src/lib/`.
- Admin changes need tests under `apps/admin/src/lib/` when behavior can be expressed without browser automation.
- Edge Function changes need function-level or architecture tests plus `npm run check:functions`.
- Electron/release changes need `npm run check:electron`.

## Supabase Workflow

List projects:

```powershell
npx supabase projects list
```

Deploy selected functions:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "token-from-supabase"
npx supabase functions deploy generate-tryon --project-ref dzfbjscrpxhpyeimggut
```

Deploy the standard totem backend set:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "token-from-supabase"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-supabase-totem.ps1
```

If schema changed, review migrations and run the deploy script with database credentials supplied securely. Do not place database passwords in Git.

## GitHub Workflow

Normal change flow:

```powershell
git status --short
npm run check:affected
git add <files>
git commit -m "short imperative message"
git push origin main
```

Windows kiosk release flow:

```powershell
npm run release:kiosk
```

If the release script cannot find a GitHub token, authenticate Git Credential Manager:

```powershell
git credential-manager github login
```

Then rerun the release or manually publish the generated assets using the same asset list in `scripts/release-kiosk.ps1`.

## Codex Working Rules

- Start from `docs/HANDOFF.md`, `AGENTS.md`, and `docs/architecture/INDEX.md`.
- Open only files related to the current task.
- Use `rg` for search.
- Do not load old giant threads for context.
- Preserve unrelated user changes.
- Use `apply_patch` for manual edits.
- Test/build before claiming a task is complete.
```

- [ ] **Step 2: Verify key commands are documented**

Run:

```powershell
Select-String -Path docs/DEVELOPMENT.md -Pattern "check:affected","check:kiosk","deploy-supabase-totem","release:kiosk"
```

Expected: each pattern appears at least once.

- [ ] **Step 3: Commit Task 2**

Run:

```powershell
git add docs/DEVELOPMENT.md
git commit -m "docs: add development guide"
```

Expected: commit succeeds.

## Task 3: Create The Operations Runbook

**Files:**
- Create: `docs/OPERATIONS.md`

- [ ] **Step 1: Create the operations document**

Create `docs/OPERATIONS.md` with this content:

```markdown
# FanFrame Totem Operations Runbook

## Production Surfaces

| Surface | URL or Ref | Notes |
| --- | --- | --- |
| Admin web | `https://fanframe-totem.vercel.app/` | Official remote admin |
| Kiosk web/test | `https://fanframe-kiosk-web.vercel.app/` | Browser-based kiosk testing |
| Supabase | `dzfbjscrpxhpyeimggut` | Production totem backend |
| GitHub releases | `fanframe-ai/fanframe-totem/releases` | Windows kiosk updater assets |

## Payment Rules

- Real payment provider is PagBank PIX.
- Simulated/test payment is only for tests and must not count as real sales.
- A paid session must either create a generation queue, complete with a result, or be marked as a recoverable failed session.
- Never ask a customer to pay again for a session already marked paid.

## Edge Functions To Know

| Function | Responsibility |
| --- | --- |
| `create-kiosk-payment` | Creates PIX payment or simulated payment for kiosk/test |
| `pagbank-webhook` | Receives PagBank payment updates |
| `generate-tryon` | Starts AI generation and creates durable queue records |
| `replicate-webhook` | Completes or fails queued generations |
| `create-delivery-link` | Creates/serves QR delivery links |
| `recover-kiosk-photos` | Finds completed or paid-without-result sessions by CPF |
| `mark-kiosk-session-error` | Persists kiosk session errors after payment |
| `report-kiosk-health` | Device heartbeat/status |
| `poll-kiosk-commands` | Remote device commands |
| `manage-kiosk-test-links` | Admin-created online kiosk test links |

## Incident: Paid Session Without Generated Photo

Use this when a user paid, took a photo, and the kiosk showed an error during generation.

1. Identify the device in `kiosk_devices` by label/device code.
2. Find recent `kiosk_payments` with `status = 'paid'` for that device.
3. Join to `kiosk_sessions` by `session_id`.
4. Check whether `kiosk_sessions.generation_queue_id` is null.
5. Check `generation_queue` and `generations` for matching records.
6. Check `kiosk_device_events` around the paid time.
7. If session is paid with no queue/result, treat it as recoverable. Do not count another payment.

Read-only SQL shape:

```sql
select
  p.id as payment_id,
  p.session_id,
  p.status as payment_status,
  p.provider,
  p.paid_at,
  s.status as session_status,
  s.generation_queue_id,
  s.result_image_url,
  s.error_message
from kiosk_payments p
left join kiosk_sessions s on s.id = p.session_id
where p.device_id = '<device-id>'
  and p.status = 'paid'
order by p.created_at desc
limit 20;
```

The admin operational health page should surface non-simulated paid sessions without `generation_queue_id`.

## Deploy Edge Functions

Deploy selected functions:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "token-from-supabase"
npx supabase functions deploy generate-tryon --project-ref dzfbjscrpxhpyeimggut
npx supabase functions deploy recover-kiosk-photos --project-ref dzfbjscrpxhpyeimggut
npx supabase functions deploy mark-kiosk-session-error --project-ref dzfbjscrpxhpyeimggut
```

Deploy the standard totem set:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "token-from-supabase"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-supabase-totem.ps1
```

## Release Windows Kiosk

Use this when `src/`, `electron/`, shared kiosk UI, kiosk config, or packaging behavior changes:

```powershell
npm run release:kiosk
```

This bumps patch version, runs tests/lint/builds, generates Windows artifacts, commits the version bump, pushes `main`, and publishes a GitHub Release.

Verify local artifacts:

```powershell
npm run release:kiosk:verify
```

## Vercel Deploys

Admin web deploys from GitHub through Vercel. Kiosk web/test is a separate Vercel project using the root Vite app.

Kiosk web/test expected settings:

```text
Build command: npm run build
Output directory: dist
```

Admin project is under `apps/admin` and uses its own package scripts.

## Operational Checks After Release

1. Confirm GitHub Release exists and includes `latest.yml`.
2. Confirm Supabase functions changed in the release are deployed.
3. Open admin and confirm the Problems/operational health page loads.
4. Open kiosk web/test link and run a simulated payment.
5. Confirm simulated payment does not count as real sale.
6. For Windows kiosk, confirm updater sees the new release or install the new setup manually.
```

- [ ] **Step 2: Verify operations doc references the critical incident flow**

Run:

```powershell
Select-String -Path docs/OPERATIONS.md -Pattern "Paid Session Without Generated Photo","mark-kiosk-session-error","release:kiosk"
```

Expected: all three patterns are present.

- [ ] **Step 3: Commit Task 3**

Run:

```powershell
git add docs/OPERATIONS.md
git commit -m "docs: add operations runbook"
```

Expected: commit succeeds.

## Task 4: Create The Access Matrix

**Files:**
- Create: `docs/ACCESS.md`

- [ ] **Step 1: Create access documentation without secrets**

Create `docs/ACCESS.md` with this content:

```markdown
# FanFrame Totem Access Matrix

This file lists required access. It must never contain actual secrets, passwords, tokens, service-role keys, customer data, CPF values, or device secrets.

## Required Access

| System | Needed For | Required Scope |
| --- | --- | --- |
| GitHub repo `fanframe-ai/fanframe-totem` | Code, releases, issue/PR history | Push to `main`, create tags/releases, upload release assets |
| Vercel admin project | Admin web deployment and env vars | Project member with deployment/env access |
| Vercel kiosk web project | Online kiosk test deployment and env vars | Project member with deployment/env access |
| Supabase project `dzfbjscrpxhpyeimggut` | Database, Edge Functions, logs, secrets | Project admin/developer; service role only in backend tools |
| PagBank | Real PIX payment integration | Production API credential management and webhook settings |
| Replicate | AI generation provider | API token management and usage visibility |
| Physical Windows kiosk | Local config, camera, updater, logs | Windows admin or operator access |

## Local Files That Stay Local

| File | Why |
| --- | --- |
| `.env` | Local frontend env values |
| `kiosk.config.json` | Device pairing/config secrets |
| Supabase access token temp files | CLI auth only |
| Build output in `release/` | Generated artifacts; GitHub Release stores published binaries |

## Safe Sharing Rule

Share the GitHub URL and this documentation. Share credentials through the team's password manager or direct secure channel. Do not paste credentials into Codex, GitHub issues, Markdown docs, or screenshots.

## Token Rotation Rule

Rotate any token that was pasted into chat, logs, screenshots, or shell history. Supabase personal access tokens and GitHub tokens should be treated as compromised once pasted into a long-lived conversation.
```

- [ ] **Step 2: Check for accidental secret-looking strings**

Run:

```powershell
Select-String -Path docs/ACCESS.md -Pattern "sbp_","eyJ","service_role","PAGBANK_API_TOKEN="
```

Expected: no matches.

- [ ] **Step 3: Commit Task 4**

Run:

```powershell
git add docs/ACCESS.md
git commit -m "docs: add access matrix"
```

Expected: commit succeeds.

## Task 5: Create The New Developer Checklist

**Files:**
- Create: `docs/ONBOARDING_CHECKLIST.md`

- [ ] **Step 1: Create the onboarding checklist**

Create `docs/ONBOARDING_CHECKLIST.md` with this content:

```markdown
# New Developer Onboarding Checklist

Use this checklist after receiving access to the GitHub repository.

## Repository

- [ ] Clone `fanframe-ai/fanframe-totem`.
- [ ] Run `npm install`.
- [ ] Read `README.md`.
- [ ] Read `docs/HANDOFF.md`.
- [ ] Read `AGENTS.md`.
- [ ] Read `docs/architecture/INDEX.md`.

## Local Environment

- [ ] Create `.env` from `.env.example`.
- [ ] Confirm `.env` is ignored by Git.
- [ ] Run `npm run check:affected`.
- [ ] Run `npm run dev`.
- [ ] Run `npm run admin:dev`.

## Supabase

- [ ] Confirm access to project `dzfbjscrpxhpyeimggut`.
- [ ] Run `npx supabase projects list`.
- [ ] Confirm Edge Functions page is visible.
- [ ] Confirm database tables `kiosk_sessions`, `kiosk_payments`, `generation_queue`, and `kiosk_devices` are visible.

## Admin And Kiosk

- [ ] Open admin web: `https://fanframe-totem.vercel.app/`.
- [ ] Confirm admin login works.
- [ ] Open kiosk web/test: `https://fanframe-kiosk-web.vercel.app/`.
- [ ] Create or receive a kiosk test link from admin.
- [ ] Confirm simulated payment is labeled as test/simulated.

## Release Capability

- [ ] Confirm GitHub push works.
- [ ] Confirm Git Credential Manager login works.
- [ ] Run `npm run release:kiosk:dry`.
- [ ] Confirm `npm run release:kiosk:verify` works after a local release build.

## Incident Drill

- [ ] Read `docs/OPERATIONS.md`.
- [ ] Explain what to inspect when a paid PIX session has no generated photo.
- [ ] Identify which function persists kiosk errors after payment.
- [ ] Identify why simulated payments must not count as real sales.

## Completion

When every item above is checked, the developer can take normal FanFrame Totem tasks through Codex without loading old threads.
```

- [ ] **Step 2: Verify checklist covers required systems**

Run:

```powershell
Select-String -Path docs/ONBOARDING_CHECKLIST.md -Pattern "Supabase","Admin","Kiosk","Release","Incident"
```

Expected: all five patterns are present.

- [ ] **Step 3: Commit Task 5**

Run:

```powershell
git add docs/ONBOARDING_CHECKLIST.md
git commit -m "docs: add onboarding checklist"
```

Expected: commit succeeds.

## Task 6: Create The Documentation Inventory

**Files:**
- Create: `docs/DOCS_INDEX.md`

- [ ] **Step 1: Create documentation inventory**

Create `docs/DOCS_INDEX.md` with this content:

```markdown
# FanFrame Totem Documentation Index

## Canonical Entry Points

| Doc | Status | Purpose |
| --- | --- | --- |
| `docs/HANDOFF.md` | Canonical | First document for new developers |
| `AGENTS.md` | Canonical | Rules for Codex and agentic development |
| `docs/architecture/INDEX.md` | Canonical | Router for flow-specific technical context |
| `docs/DEVELOPMENT.md` | Canonical | Local setup and validation |
| `docs/OPERATIONS.md` | Canonical | Production operations and incident response |
| `docs/ACCESS.md` | Canonical | Access matrix without secrets |
| `docs/ONBOARDING_CHECKLIST.md` | Canonical | New developer readiness checklist |

## Architecture Docs

| Doc | Use For |
| --- | --- |
| `docs/architecture/kiosk-flow.md` | Kiosk screens, steps, session state |
| `docs/architecture/payment-flow.md` | PIX, PagBank, CPF, paid-session contracts |
| `docs/architecture/generation-flow.md` | Replicate, queue, webhook, failure handling |
| `docs/architecture/delivery-flow.md` | QR code, delivery links, photo recovery |
| `docs/architecture/admin-publish-flow.md` | Admin config publishing and preview |
| `docs/architecture/data-model.md` | Tables, RLS, schema contracts |

## Operational Docs

| Doc | Use For |
| --- | --- |
| `docs/release-automation.md` | Windows release process |
| `docs/kiosk-totem.md` | Kiosk operation |
| `docs/kiosk-installation-owner-guide.md` | Owner/operator install guide |
| `docs/go-live-checklist.md` | Production readiness |
| `docs/windows-kiosk-release.md` | Windows kiosk release notes/process |
| `docs/security-production-review.md` | Production security review context |
| `docs/replicate-integration.md` | Replicate integration details |
| `docs/design-system.md` | Visual/design system guidance |

## Historical Or Planning Docs

| Path | Status |
| --- | --- |
| `docs/DOCUMENTATION.md` | Historical. Contains older app context and encoding artifacts. Prefer the canonical docs above. |
| `docs/superpowers/specs/` | Historical specs. Use only when investigating why a feature was designed. |
| `docs/superpowers/plans/` | Historical execution plans. Use only when tracing implementation history. |

## Rule For New Docs

Add new docs only when they become a reusable source of truth. Link them from this index and from `docs/HANDOFF.md` if they affect onboarding.
```

- [ ] **Step 2: Verify all new docs are indexed**

Run:

```powershell
Select-String -Path docs/DOCS_INDEX.md -Pattern "HANDOFF.md","DEVELOPMENT.md","OPERATIONS.md","ACCESS.md","ONBOARDING_CHECKLIST.md"
```

Expected: all five files appear.

- [ ] **Step 3: Commit Task 6**

Run:

```powershell
git add docs/DOCS_INDEX.md
git commit -m "docs: add documentation index"
```

Expected: commit succeeds.

## Task 7: Update Existing Entry Points

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/INDEX.md`
- Modify: `docs/release-automation.md`

- [ ] **Step 1: Update README**

Replace the "Comece Aqui" section in `README.md` with:

```markdown
## Comece Aqui

- Handoff completo para novo dev: `docs/HANDOFF.md`
- Mapa de documentacao: `docs/DOCS_INDEX.md`
- Guia de desenvolvimento: `docs/DEVELOPMENT.md`
- Operacao e incidentes: `docs/OPERATIONS.md`
- Mapa para manutencao por fluxo: `docs/architecture/INDEX.md`
- Regras para agentes/Codex: `AGENTS.md`
```

- [ ] **Step 2: Update AGENTS**

Add this section after "Comece por `docs/architecture/INDEX.md`. Abra somente o fluxo relacionado a tarefa." in `AGENTS.md`:

```markdown
## Handoff First

Para um novo dev ou nova thread Codex, comece por `docs/HANDOFF.md`, depois use `docs/architecture/INDEX.md` para abrir somente o fluxo da tarefa. Nao carregue threads antigas gigantes como fonte primaria de contexto.
```

- [ ] **Step 3: Update architecture index**

Add this section near the top of `docs/architecture/INDEX.md`, after the opening sentence:

```markdown
## Documentos De Entrada

- Novo dev assumindo o projeto: `../HANDOFF.md`
- Ambiente local e checks: `../DEVELOPMENT.md`
- Operacao, deploy e incidentes: `../OPERATIONS.md`
- Acessos necessarios sem secrets: `../ACCESS.md`
- Inventario de docs: `../DOCS_INDEX.md`
```

- [ ] **Step 4: Update release automation doc**

Add this section before "## Release do app Windows" in `docs/release-automation.md`:

```markdown
## Responsabilidade De Release

Mudancas no app Windows do totem precisam gerar uma nova GitHub Release com instalador, portable, blockmap e `latest.yml`. O runbook operacional completo fica em `docs/OPERATIONS.md`.
```

- [ ] **Step 5: Verify links are present**

Run:

```powershell
Select-String -Path README.md,AGENTS.md,docs/architecture/INDEX.md,docs/release-automation.md -Pattern "HANDOFF.md","OPERATIONS.md","DOCS_INDEX.md"
```

Expected: `HANDOFF.md` appears in README, AGENTS, and architecture index; `OPERATIONS.md` appears in README, architecture index, and release automation; `DOCS_INDEX.md` appears in README and architecture index.

- [ ] **Step 6: Commit Task 7**

Run:

```powershell
git add README.md AGENTS.md docs/architecture/INDEX.md docs/release-automation.md
git commit -m "docs: link handoff entry points"
```

Expected: commit succeeds.

## Task 8: Validate Documentation And Context Map

**Files:**
- Modify if generated: `.codex/context-map.md`

- [ ] **Step 1: Run whitespace check**

Run:

```powershell
git diff --check HEAD
```

Expected: no whitespace errors. CRLF warnings are acceptable on this Windows repo.

- [ ] **Step 2: Regenerate context map**

Run:

```powershell
npm run context:map
```

Expected output includes:

```text
Context map escrito em .codex\context-map.md.
```

- [ ] **Step 3: Verify context map**

Run:

```powershell
npm run context:check
```

Expected output includes:

```text
Context map atualizado.
```

- [ ] **Step 4: Run docs-adjacent affected check**

Run:

```powershell
npm run check:affected
```

Expected: command exits 0. If it reports no relevant code checks for doc-only changes, that is acceptable.

- [ ] **Step 5: Commit context map if changed**

Run:

```powershell
git status --short
```

If `.codex/context-map.md` changed, run:

```powershell
git add .codex/context-map.md
git commit -m "docs: update context map"
```

Expected: commit succeeds or no commit is needed.

## Task 9: Push And Produce The Handoff Message

**Files:**
- No code files.

- [ ] **Step 1: Push the documentation commits**

Run:

```powershell
git status --short
git push origin main
```

Expected: worktree is clean before push, and push succeeds.

- [ ] **Step 2: Verify GitHub has the docs**

Run:

```powershell
git ls-remote origin refs/heads/main
```

Expected: remote `main` points at the local `HEAD` commit.

- [ ] **Step 3: Send this handoff message to the new developer**

Use this exact message:

```text
Segue o repo do FanFrame Totem:
https://github.com/fanframe-ai/fanframe-totem

Comece por estes arquivos:
1. docs/HANDOFF.md
2. AGENTS.md
3. docs/architecture/INDEX.md
4. docs/ONBOARDING_CHECKLIST.md

Nao use threads antigas do Codex como fonte primaria de contexto. O repo agora tem o mapa de desenvolvimento, operacao, acessos, arquitetura, release Windows e runbook de incidentes.
```

## Self-Review Checklist

- [ ] The plan creates one canonical handoff entry point.
- [ ] The plan documents production URLs and Supabase project ref.
- [ ] The plan documents that PagBank PIX is the real payment provider.
- [ ] The plan documents that simulated payments do not count as real sales.
- [ ] The plan documents release responsibilities for Windows kiosk changes.
- [ ] The plan avoids committing secrets.
- [ ] The plan keeps older docs available but labels stale/historical docs clearly.
- [ ] The plan includes exact validation commands and expected results.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-07-03-project-handoff-documentation.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

