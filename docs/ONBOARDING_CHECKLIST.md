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
