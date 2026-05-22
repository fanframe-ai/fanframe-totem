# Security Production Review

## Secrets
- PagBank token: Supabase Edge Function environment only, via `PAGBANK_API_TOKEN`.
- Replicate token: Supabase Edge Function environment only, via `REPLICATE_API_TOKEN`.
- Supabase service role: Edge Functions only, never in the public kiosk or admin frontend.
- Frontend secret scan checked for PagBank, Replicate, service role, token, password and known token prefixes.

## Public Frontend
- Uses only the publishable Supabase key.
- Does not read PagBank, Replicate or service-role credentials from browser code.
- Kiosk payment requests send device/session context, never provider secrets.

## QR Links
- Delivery links use temporary random tokens.
- Expiration is enforced server-side before rendering the mobile page.
- Download count is tracked in `kiosk_delivery_links`.
- Social sharing consent is an explicit POST action and unsupported POST actions are rejected.

## Payments
- PIX order creation runs inside the `create-kiosk-payment` Edge Function.
- Raw PagBank errors are logged server-side and replaced with safe user-facing messages.
- The app accepts only PIX in normal mode; simulated payments remain technical/test-only.

## Admin
- Supabase Auth is required.
- Roles: `super_admin`, `admin`, `support`, `finance`.
- Sensitive provider tokens are not displayed to operators.

## Devices
- Each totem is paired with a device code and local secret hash.
- Device commands and configuration are scoped to the paired device.
- Remote updates are configured from the admin panel but executed locally by the Windows kiosk.
