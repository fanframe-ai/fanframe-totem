# FanFrame Totem Network Operations Design

## Goal

Make FanFrame Totem easy to operate across many physical Windows totens in Brazil, with centralized control by the platform owner and a limited local maintenance experience for each totem owner.

## Operating Model

The platform owner manages the business and product remotely from the admin panel at `https://fanframe-totem.vercel.app/`. The owner creates teams, configures AI prompts, uploads shirts/backgrounds, sets prices, reviews payments, monitors health, and fixes software configuration.

The physical totem owner only manages the PC and peripherals: internet, webcam, PagBank/PlugPag device, power, app installation, and local restart/test actions. They must not change AI prompts, prices, teams, Supabase, Replicate, PagBank credentials, or production rules.

The end customer only sees the kiosk flow: choose options, pay, take a photo, wait for AI, scan the result QR Code, and leave.

## Core Decision

The MVP will not use QR Code for totem setup. A QR Code is still used for customer image delivery, but setup uses a short installation code.

The admin creates a totem record and generates a single-use installation code such as `RECIFE-001` or `FF-8K42`. The totem owner installs the Windows app, enters the code on first boot, and the app downloads its assigned team/configuration. After pairing, the app locks to that device identity.

## Roles

- `super_admin`: full platform owner access. Can manage teams, prompts, prices, assets, users, devices, payments, maintenance state, and update rollout.
- `admin`: internal operator access. Can manage operational data but not sensitive secrets or super admin users.
- `support`: can view status, sessions, logs, and send safe remote commands such as sync/restart/diagnostics. Cannot change prices, prompts, or payment settings.
- `finance`: can view/export payments and sales, without editing teams/devices/prompts.
- `totem_owner`: optional future portal role. Can view only their own assigned totens, installation instructions, basic status, and support docs.

For the MVP, only `super_admin`, `admin`, and `support` are required. `finance` and `totem_owner` can be added after the operational loop is stable.

## Device Lifecycle

1. Admin creates or selects a team.
2. Admin creates a physical totem record with label, location, owner contact, expected app version, and team assignment.
3. Admin generates a short installation code with expiration and one-use semantics.
4. Totem owner installs the Windows app.
5. First boot shows a pairing screen with an installation code input.
6. App calls a Supabase Edge Function to redeem the code.
7. Backend validates expiration and availability, assigns a generated `device_secret`, stores a hash, and returns non-sensitive kiosk config.
8. App stores the paired identity locally.
9. App starts periodic health reporting and config sync.
10. Admin sees the device online and can monitor/operate it remotely.

If a PC is replaced, the admin invalidates the old pairing and generates a new installation code.

## Local Kiosk Modes

The Windows app has three modes:

- Pairing mode: first-run installation code input.
- Customer kiosk mode: fullscreen portrait customer flow.
- Technical mode: PIN-protected local maintenance screen.

Technical mode is opened with a hidden shortcut such as `Ctrl + Shift + F12` and a local support PIN. It shows only operational controls:

- internet status;
- Supabase status;
- PagBank/PlugPag status;
- webcam status;
- app version;
- device code;
- last sync time;
- test camera;
- test payment;
- sync now;
- restart app;
- send diagnostics;
- exit kiosk, protected by PIN.

It does not show AI prompt, prices as editable data, Supabase keys, Replicate tokens, PagBank secrets, or admin features.

## Remote Control Model

The totem PC should not require inbound network access. Instead, the kiosk app polls Supabase/Edge Functions for remote commands every 15-30 seconds while online.

Supported MVP commands:

- `sync_config`: fetch latest team/device configuration.
- `enter_maintenance`: block customer flow and show maintenance message.
- `exit_maintenance`: return to customer flow if health checks pass.
- `send_diagnostics`: upload recent local status/log summary.
- `restart_app`: request Electron relaunch.

Commands have status: `pending`, `running`, `succeeded`, `failed`, `expired`.

## Health And Diagnostics

The kiosk app reports health on boot, on every completed session, on errors, and periodically while idle.

Health payload includes:

- app version;
- device code;
- connection status;
- Supabase reachability;
- camera availability;
- payment provider mode/status;
- current screen/state;
- last session id;
- last error code/message;
- local timestamp;
- kiosk config version.

Operational events are stored in `kiosk_device_events`, including:

- `app_started`;
- `pairing_started`;
- `pairing_succeeded`;
- `config_synced`;
- `health_reported`;
- `payment_started`;
- `payment_paid`;
- `camera_error`;
- `generation_failed`;
- `session_completed`;
- `technical_mode_opened`;
- `remote_command_received`;
- `remote_command_completed`;
- `app_reset`.

## Admin UX

The admin panel should become the central operations console:

- dashboard with online/offline/maintenance/error counters;
- sales and revenue today;
- payment pending/failed counters;
- AI failures;
- devices requiring attention;
- device detail page with timeline, health, sessions, payments, commands, and owner contact;
- installation code generation;
- filters by team, city/location, device status, app version, and last contact;
- safe actions with confirmation for maintenance/blocking/re-pairing.

The Devices area should be the first major upgrade because it anchors installation, maintenance, and remote control.

## Security

- Installation codes are short-lived and single-use.
- Plain installation codes are never stored; only a hash is stored.
- Device secrets are generated server-side and stored locally only on the kiosk PC.
- Device secrets are stored hashed in Supabase.
- Sensitive credentials remain in Supabase Secrets, not frontend code.
- Totem requests authenticate with device code plus device secret.
- Admin requests authenticate through Supabase Auth and role checks.
- Important admin actions generate audit events.
- The app can be remotely disabled if a device is lost, sold, or misconfigured.

## Maintenance Experience

Local messages must be simple:

- `NET-001`: internet unavailable.
- `CAM-001`: camera not found.
- `PAY-001`: payment provider unavailable.
- `CFG-001`: configuration sync failed.
- `IA-001`: generation unavailable.

Admin views show deeper detail: stack/error payload, timestamps, version, device, team, session, payment id, and recent events.

## Update Strategy

MVP update model:

- admin tracks installed `app_version`;
- admin shows outdated devices;
- owner downloads a new installer link and installs over the current app;
- technical screen shows version and last update check.

Later update model:

- signed Electron auto-update;
- release channels: `stable`, `beta`, `maintenance`;
- staged rollout to one pilot device before all devices;
- rollback flag in admin.

## Success Criteria

- A non-technical totem owner can install the app and pair it with a short code without editing files.
- The platform owner can see whether each totem is online, healthy, and selling.
- The owner can identify common failures without asking for screenshots or remote desktop.
- A totem cannot change team, price, prompt, or payment configuration locally.
- The admin can remotely place a totem into maintenance and request diagnostics.
- The customer-facing kiosk remains simple and locked after pairing.
