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
