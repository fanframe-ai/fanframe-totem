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
