# Kiosk Network Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a remotely managed totem network where each Windows kiosk is paired by a short installation code, reports health, receives safe remote commands, and stays locked to the assigned team.

**Architecture:** Supabase remains the control plane. The admin app creates installation codes, monitors devices, and sends commands. The Electron kiosk redeems a code once, stores a device identity locally, periodically reports health, polls commands, and exposes only a limited PIN-protected technical screen.

**Tech Stack:** React/Vite, Electron, Supabase Postgres/RLS/Edge Functions, TypeScript, Vitest.

---

## File Structure

- Create `supabase/migrations/20260510120000_add_kiosk_pairing_operations.sql`: pairing, events, command, health, and audit schema.
- Create `supabase/functions/redeem-kiosk-install-code/index.ts`: first-run kiosk pairing endpoint.
- Create `supabase/functions/report-kiosk-health/index.ts`: authenticated device health/event endpoint.
- Create `supabase/functions/poll-kiosk-commands/index.ts`: authenticated command polling/completion endpoint.
- Modify `supabase/config.toml`: register new Edge Functions.
- Modify `src/lib/kiosk.ts`: shared kiosk config, hashing, device auth, error codes, command types.
- Create `src/lib/kioskPairing.test.ts`: pure tests for pairing and health helpers.
- Modify `src/types/kiosk.d.ts`: Electron bridge types for pairing, technical mode, health, and command polling.
- Modify `electron/main.cjs`: local config storage, app relaunch, health bridge, technical shortcut.
- Modify `electron/preload.cjs`: expose safe kiosk APIs to renderer.
- Modify `src/pages/Kiosk.tsx`: first-run pairing screen, locked kiosk state, technical mode, health loop, command loop.
- Create `apps/admin/src/lib/deviceOperations.ts`: admin helper functions for installation codes and commands.
- Modify `apps/admin/src/App.tsx`: device detail, installation code generation, status timeline, and remote command UI.
- Modify `apps/admin/src/lib/types.ts`: add typed device health, command, event, and install code rows.
- Create `docs/kiosk-installation-owner-guide.md`: short guide for totem owners.

---

### Task 1: Database Model For Pairing And Operations

**Files:**
- Create: `supabase/migrations/20260510120000_add_kiosk_pairing_operations.sql`
- Modify: `src/integrations/supabase/types.ts` after applying migration and regenerating types
- Modify: `apps/admin/src/lib/types.ts`

- [ ] **Step 1: Create the migration**

Add this migration:

```sql
ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS install_status TEXT NOT NULL DEFAULT 'not_paired',
  ADD COLUMN IF NOT EXISTS paired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expected_app_version TEXT,
  ADD COLUMN IF NOT EXISTS update_channel TEXT NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS support_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_health_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_health_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_reason TEXT,
  ADD CONSTRAINT kiosk_devices_install_status_supported
    CHECK (install_status IN ('not_paired', 'paired', 'revoked')),
  ADD CONSTRAINT kiosk_devices_update_channel_supported
    CHECK (update_channel IN ('stable', 'beta', 'maintenance'));

CREATE TABLE IF NOT EXISTS public.kiosk_install_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_fingerprint TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_install_codes_expiry_future CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.kiosk_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  error_code TEXT,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_device_events_severity_supported
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

CREATE TABLE IF NOT EXISTS public.kiosk_device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  CONSTRAINT kiosk_device_commands_type_supported
    CHECK (command_type IN ('sync_config', 'enter_maintenance', 'exit_maintenance', 'send_diagnostics', 'restart_app')),
  CONSTRAINT kiosk_device_commands_status_supported
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.kiosk_admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_install_codes_device ON public.kiosk_install_codes(device_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_install_codes_expires ON public.kiosk_install_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_events_device_created ON public.kiosk_device_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_events_type ON public.kiosk_device_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kiosk_device_commands_device_status ON public.kiosk_device_commands(device_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_health ON public.kiosk_devices(last_health_at DESC);

ALTER TABLE public.kiosk_install_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_admin_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kiosk install codes" ON public.kiosk_install_codes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view kiosk events" ON public.kiosk_device_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage kiosk commands" ON public.kiosk_device_commands
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view audit events" ON public.kiosk_admin_audit_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
```

- [ ] **Step 2: Apply the migration locally or to the linked Supabase project**

Run:

```bash
supabase db push
```

Expected: migration is applied without SQL errors.

- [ ] **Step 3: Regenerate Supabase types**

Run:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Expected: `kiosk_install_codes`, `kiosk_device_events`, `kiosk_device_commands`, and new `kiosk_devices` columns appear in the generated types.

- [ ] **Step 4: Update admin app row types**

In `apps/admin/src/lib/types.ts`, add:

```ts
export type InstallStatus = "not_paired" | "paired" | "revoked";
export type CommandStatus = "pending" | "running" | "succeeded" | "failed" | "expired";
export type CommandType = "sync_config" | "enter_maintenance" | "exit_maintenance" | "send_diagnostics" | "restart_app";

export type KioskDeviceEvent = {
  id: string;
  device_id: string | null;
  team_id: string | null;
  session_id: string | null;
  event_type: string;
  severity: "debug" | "info" | "warning" | "error" | "critical";
  error_code: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type KioskDeviceCommand = {
  id: string;
  device_id: string;
  command_type: CommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  result: Record<string, unknown>;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  expires_at: string;
};
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260510120000_add_kiosk_pairing_operations.sql src/integrations/supabase/types.ts apps/admin/src/lib/types.ts
git commit -m "feat: add kiosk operations schema"
```

---

### Task 2: Shared Kiosk Security And Status Helpers

**Files:**
- Modify: `src/lib/kiosk.ts`
- Create: `src/lib/kioskPairing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/kioskPairing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDeviceAuthHeaders,
  classifyKioskError,
  normalizeInstallCode,
  shouldReportHealth,
} from "./kiosk";

describe("kiosk pairing helpers", () => {
  it("normalizes installation codes for human input", () => {
    expect(normalizeInstallCode(" ff-recife 001 ")).toBe("FF-RECIFE-001");
    expect(normalizeInstallCode("ff 8k42")).toBe("FF-8K42");
  });

  it("builds device auth headers without exposing raw config names", () => {
    expect(buildDeviceAuthHeaders({ deviceCode: "TOTEM-1", deviceSecret: "secret" })).toEqual({
      "x-device-code": "TOTEM-1",
      "x-device-secret": "secret",
    });
  });

  it("reports health when never reported or interval elapsed", () => {
    expect(shouldReportHealth(null, 60_000, 100_000)).toBe(true);
    expect(shouldReportHealth(50_000, 60_000, 100_000)).toBe(false);
    expect(shouldReportHealth(39_999, 60_000, 100_000)).toBe(true);
  });

  it("maps common failures to owner-friendly codes", () => {
    expect(classifyKioskError("camera not found").code).toBe("CAM-001");
    expect(classifyKioskError("network offline").code).toBe("NET-001");
    expect(classifyKioskError("pagbank timeout").code).toBe("PAY-001");
    expect(classifyKioskError("config fetch failed").code).toBe("CFG-001");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npm run test -- src/lib/kioskPairing.test.ts
```

Expected: FAIL because the helper exports do not exist yet.

- [ ] **Step 3: Implement helpers**

Add these exports to `src/lib/kiosk.ts`:

```ts
export type DeviceIdentity = {
  deviceCode: string;
  deviceSecret: string;
};

export type KioskErrorCode = "NET-001" | "CAM-001" | "PAY-001" | "CFG-001" | "IA-001" | "APP-001";

export type KioskFriendlyError = {
  code: KioskErrorCode;
  title: string;
  action: string;
};

export function normalizeInstallCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function buildDeviceAuthHeaders(identity: DeviceIdentity) {
  return {
    "x-device-code": identity.deviceCode,
    "x-device-secret": identity.deviceSecret,
  };
}

export function shouldReportHealth(lastReportAt: number | null, intervalMs: number, now = Date.now()) {
  return lastReportAt === null || now - lastReportAt >= intervalMs;
}

export function classifyKioskError(message: string): KioskFriendlyError {
  const text = message.toLowerCase();
  if (text.includes("camera") || text.includes("webcam")) {
    return { code: "CAM-001", title: "Camera nao encontrada", action: "Verifique se a webcam esta conectada e teste novamente." };
  }
  if (text.includes("network") || text.includes("internet") || text.includes("offline")) {
    return { code: "NET-001", title: "Internet indisponivel", action: "Verifique a conexao do PC e clique em tentar novamente." };
  }
  if (text.includes("pagbank") || text.includes("plugpag") || text.includes("payment")) {
    return { code: "PAY-001", title: "Pagamento indisponivel", action: "Verifique a maquininha ou tente PIX." };
  }
  if (text.includes("config") || text.includes("sync")) {
    return { code: "CFG-001", title: "Configuracao nao sincronizada", action: "Clique em sincronizar ou chame o suporte." };
  }
  if (text.includes("replicate") || text.includes("generation") || text.includes("ia")) {
    return { code: "IA-001", title: "Geracao indisponivel", action: "Aguarde alguns minutos e tente novamente." };
  }
  return { code: "APP-001", title: "Erro do aplicativo", action: "Reinicie o app e envie diagnostico se continuar." };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/lib/kioskPairing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk.ts src/lib/kioskPairing.test.ts
git commit -m "feat: add kiosk pairing helpers"
```

---

### Task 3: Edge Functions For Pairing, Health, And Commands

**Files:**
- Create: `supabase/functions/redeem-kiosk-install-code/index.ts`
- Create: `supabase/functions/report-kiosk-health/index.ts`
- Create: `supabase/functions/poll-kiosk-commands/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Register functions**

Add to `supabase/config.toml`:

```toml
[functions.redeem-kiosk-install-code]
verify_jwt = false

[functions.report-kiosk-health]
verify_jwt = false

[functions.poll-kiosk-commands]
verify_jwt = false
```

- [ ] **Step 2: Implement `redeem-kiosk-install-code`**

Create `supabase/functions/redeem-kiosk-install-code/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { installCode, fingerprint, appVersion } = await req.json();
    if (!installCode) return json({ error: "Missing install code" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const codeHash = await sha256(normalizeCode(String(installCode)));
    const { data: install, error: installError } = await supabase
      .from("kiosk_install_codes")
      .select("id, device_id, expires_at, redeemed_at, kiosk_devices(*, teams(*))")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (installError) throw installError;
    if (!install) return json({ error: "Invalid install code" }, 404);
    if (install.redeemed_at) return json({ error: "Install code already used" }, 409);
    if (new Date(install.expires_at).getTime() < Date.now()) return json({ error: "Install code expired" }, 410);

    const deviceSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const deviceSecretHash = await sha256(deviceSecret);
    const now = new Date().toISOString();

    const { error: deviceError } = await supabase
      .from("kiosk_devices")
      .update({
        device_secret_hash: deviceSecretHash,
        install_status: "paired",
        paired_at: now,
        last_seen_at: now,
        app_version: appVersion || null,
      })
      .eq("id", install.device_id);
    if (deviceError) throw deviceError;

    const { error: redeemError } = await supabase
      .from("kiosk_install_codes")
      .update({ redeemed_at: now, redeemed_by_fingerprint: fingerprint || null })
      .eq("id", install.id);
    if (redeemError) throw redeemError;

    const device = Array.isArray(install.kiosk_devices) ? install.kiosk_devices[0] : install.kiosk_devices;
    const team = Array.isArray(device?.teams) ? device.teams[0] : device?.teams;

    await supabase.from("kiosk_device_events").insert({
      device_id: install.device_id,
      team_id: device?.team_id || null,
      event_type: "pairing_succeeded",
      severity: "info",
      message: "Device paired by installation code",
      payload: { fingerprint: fingerprint || null, appVersion: appVersion || null },
    });

    return json({
      device: {
        id: install.device_id,
        deviceCode: device.device_code,
        label: device.label,
        location: device.location,
        configVersion: device.config_version,
      },
      team,
      deviceSecret,
    });
  } catch (error) {
    console.error("[redeem-kiosk-install-code]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
```

- [ ] **Step 3: Implement `report-kiosk-health`**

Create `supabase/functions/report-kiosk-health/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-code, x-device-secret",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const deviceCode = req.headers.get("x-device-code") || "";
    const deviceSecret = req.headers.get("x-device-secret") || "";
    if (!deviceCode || !deviceSecret) return json({ error: "Missing device auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: device, error: deviceError } = await supabase
      .from("kiosk_devices")
      .select("id, team_id, device_secret_hash, status")
      .eq("device_code", deviceCode)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return json({ error: "Unknown device" }, 404);
    if (device.status === "disabled") return json({ error: "Device disabled" }, 403);
    if (device.device_secret_hash !== await sha256(deviceSecret)) return json({ error: "Invalid device secret" }, 401);

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const health = body.health || {};
    const event = body.event || null;

    const { error: updateError } = await supabase
      .from("kiosk_devices")
      .update({
        last_seen_at: now,
        last_health_at: now,
        last_health_status: health,
        last_error_code: health.lastErrorCode || null,
        last_error_message: health.lastErrorMessage || null,
        app_version: health.appVersion || null,
      })
      .eq("id", device.id);
    if (updateError) throw updateError;

    if (event?.eventType) {
      const { error: eventError } = await supabase.from("kiosk_device_events").insert({
        device_id: device.id,
        team_id: device.team_id,
        session_id: event.sessionId || null,
        event_type: event.eventType,
        severity: event.severity || "info",
        error_code: event.errorCode || null,
        message: event.message || null,
        payload: event.payload || {},
      });
      if (eventError) throw eventError;
    }

    return json({ success: true, serverTime: now });
  } catch (error) {
    console.error("[report-kiosk-health]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
```

- [ ] **Step 4: Implement `poll-kiosk-commands`**

Create `supabase/functions/poll-kiosk-commands/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-code, x-device-secret",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadDevice(supabase: ReturnType<typeof createClient>, deviceCode: string, deviceSecret: string) {
  const { data: device, error } = await supabase
    .from("kiosk_devices")
    .select("id, team_id, device_secret_hash, status")
    .eq("device_code", deviceCode)
    .maybeSingle();
  if (error) throw error;
  if (!device) return { error: json({ error: "Unknown device" }, 404) };
  if (device.device_secret_hash !== await sha256(deviceSecret)) return { error: json({ error: "Invalid device secret" }, 401) };
  return { device };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const deviceCode = req.headers.get("x-device-code") || "";
    const deviceSecret = req.headers.get("x-device-secret") || "";
    if (!deviceCode || !deviceSecret) return json({ error: "Missing device auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const loaded = await loadDevice(supabase, deviceCode, deviceSecret);
    if (loaded.error) return loaded.error;
    const device = loaded.device!;
    const body = await req.json().catch(() => ({}));

    if (body.completeCommandId) {
      const status = body.success ? "succeeded" : "failed";
      const { error } = await supabase
        .from("kiosk_device_commands")
        .update({
          status,
          completed_at: new Date().toISOString(),
          result: body.result || {},
          error_message: body.errorMessage || null,
        })
        .eq("id", body.completeCommandId)
        .eq("device_id", device.id);
      if (error) throw error;
    }

    await supabase
      .from("kiosk_device_commands")
      .update({ status: "expired", completed_at: new Date().toISOString(), error_message: "Command expired before kiosk claimed it" })
      .eq("device_id", device.id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const { data: command, error: commandError } = await supabase
      .from("kiosk_device_commands")
      .select("*")
      .eq("device_id", device.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (commandError) throw commandError;

    if (!command) return json({ command: null });

    const { error: claimError } = await supabase
      .from("kiosk_device_commands")
      .update({ status: "running", claimed_at: new Date().toISOString() })
      .eq("id", command.id)
      .eq("status", "pending");
    if (claimError) throw claimError;

    return json({ command });
  } catch (error) {
    console.error("[poll-kiosk-commands]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
```

- [ ] **Step 5: Deploy functions**

Run:

```bash
supabase functions deploy redeem-kiosk-install-code
supabase functions deploy report-kiosk-health
supabase functions deploy poll-kiosk-commands
```

Expected: all three functions deploy to project `dzfbjscrpxhpyeimggut`.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/functions/redeem-kiosk-install-code/index.ts supabase/functions/report-kiosk-health/index.ts supabase/functions/poll-kiosk-commands/index.ts
git commit -m "feat: add kiosk device edge functions"
```

---

### Task 4: Admin Device Installation And Remote Commands

**Files:**
- Create: `apps/admin/src/lib/deviceOperations.ts`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/lib/types.ts`

- [ ] **Step 1: Add admin helper functions**

Create `apps/admin/src/lib/deviceOperations.ts`:

```ts
import { supabase } from "./supabase";
import type { CommandType } from "./types";

export function generateHumanInstallCode(label: string) {
  const normalized = label
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${normalized || "TOTEM"}-${suffix}`;
}

export async function sha256(value: string) {
  const data = new TextEncoder().encode(value.trim().toUpperCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createInstallCode(deviceId: string, label: string, hoursValid = 72) {
  const code = generateHumanInstallCode(label);
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("kiosk_install_codes").insert({
    device_id: deviceId,
    code_hash: codeHash,
    label,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { code, expiresAt };
}

export async function enqueueDeviceCommand(deviceId: string, commandType: CommandType, payload: Record<string, unknown> = {}) {
  const { error } = await supabase.from("kiosk_device_commands").insert({
    device_id: deviceId,
    command_type: commandType,
    payload,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Add device status summary helper in `apps/admin/src/App.tsx`**

Add near existing helpers:

```ts
function deviceHealthLabel(device: KioskDevice) {
  if (device.status === "disabled") return "disabled";
  if (device.status === "maintenance") return "maintenance";
  if (isOffline(device.last_seen_at)) return "offline";
  if ((device as any).last_error_code) return "attention";
  return "online";
}
```

- [ ] **Step 3: Replace the flat Devices table with install and command actions**

In `Devices()`, import helpers:

```ts
import { createInstallCode, enqueueDeviceCommand } from "./lib/deviceOperations";
```

Add state:

```ts
const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string } | null>(null);
```

Add functions:

```ts
async function generateInstall(device: KioskDevice) {
  setMessage("");
  try {
    const result = await createInstallCode(device.id, device.label || device.device_code);
    setInstallCode(result);
    setMessage(`Codigo gerado para ${device.label || device.device_code}.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Erro ao gerar codigo.");
  }
}

async function sendCommand(deviceId: string, command: CommandType) {
  setMessage("");
  try {
    await enqueueDeviceCommand(deviceId, command);
    setMessage(`Comando ${command} enviado.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Erro ao enviar comando.");
  }
}
```

Add buttons in each device row:

```tsx
<td>
  <button className="secondary" onClick={() => generateInstall(d)}>Codigo</button>
  <button className="secondary" onClick={() => sendCommand(d.id, "sync_config")}>Sync</button>
  <button className="secondary" onClick={() => sendCommand(d.id, "send_diagnostics")}>Diagnostico</button>
  <button className="danger" onClick={() => sendCommand(d.id, "enter_maintenance")}>Manutencao</button>
</td>
```

Show generated code above the table:

```tsx
{installCode && (
  <div className="notice">
    <strong>Codigo de instalacao: {installCode.code}</strong>
    <span>Expira em {dateTime(installCode.expiresAt)}</span>
  </div>
)}
```

- [ ] **Step 4: Add owner contact fields to the device form**

Extend the form state:

```ts
const [form, setForm] = useState({
  team_id: "",
  device_code: "",
  label: "",
  location: "",
  owner_name: "",
  owner_email: "",
  owner_phone: "",
  status: "active",
  device_secret: "",
});
```

Add payload fields:

```ts
owner_name: form.owner_name,
owner_email: form.owner_email,
owner_phone: form.owner_phone,
install_status: "not_paired",
```

Add inputs:

```tsx
<input placeholder="Responsavel" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
<input placeholder="Email do responsavel" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
<input placeholder="Telefone do responsavel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
```

- [ ] **Step 5: Run admin build**

Run:

```bash
npm run admin:build
```

Expected: Vite admin build passes.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/lib/deviceOperations.ts apps/admin/src/App.tsx apps/admin/src/lib/types.ts
git commit -m "feat: add admin device operations"
```

---

### Task 5: Electron Local Identity Storage And Technical APIs

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types/kiosk.d.ts`

- [ ] **Step 1: Add bridge types**

In `src/types/kiosk.d.ts`, extend the global API:

```ts
export type StoredDeviceIdentity = {
  deviceCode: string;
  deviceSecret: string;
  deviceId: string;
  teamSlug?: string;
  pairedAt: string;
};

export type KioskTechnicalStatus = {
  online: boolean;
  appVersion: string;
  deviceCode: string | null;
  lastSyncAt: string | null;
};

declare global {
  interface Window {
    fanframeKiosk?: {
      loadDeviceIdentity: () => Promise<StoredDeviceIdentity | null>;
      saveDeviceIdentity: (identity: StoredDeviceIdentity) => Promise<void>;
      clearDeviceIdentity: () => Promise<void>;
      getTechnicalStatus: () => Promise<KioskTechnicalStatus>;
      relaunch: () => Promise<void>;
      onOpenTechnicalMode: (callback: () => void) => () => void;
    };
  }
}
```

- [ ] **Step 2: Implement identity storage in Electron main**

In `electron/main.cjs`, add:

```js
const fs = require("fs");
const path = require("path");

function identityPath() {
  return path.join(app.getPath("userData"), "device-identity.json");
}

async function readIdentity() {
  try {
    return JSON.parse(await fs.promises.readFile(identityPath(), "utf8"));
  } catch {
    return null;
  }
}

async function writeIdentity(identity) {
  await fs.promises.mkdir(path.dirname(identityPath()), { recursive: true });
  await fs.promises.writeFile(identityPath(), JSON.stringify(identity, null, 2), "utf8");
}

async function clearIdentity() {
  try {
    await fs.promises.unlink(identityPath());
  } catch {
    return;
  }
}
```

Register IPC handlers after app ready:

```js
ipcMain.handle("kiosk:load-device-identity", readIdentity);
ipcMain.handle("kiosk:save-device-identity", (_event, identity) => writeIdentity(identity));
ipcMain.handle("kiosk:clear-device-identity", clearIdentity);
ipcMain.handle("kiosk:get-technical-status", async () => ({
  online: net.isOnline(),
  appVersion: app.getVersion(),
  deviceCode: (await readIdentity())?.deviceCode || null,
  lastSyncAt: null,
}));
ipcMain.handle("kiosk:relaunch", async () => {
  app.relaunch();
  app.exit(0);
});
```

Add the technical shortcut in the BrowserWindow setup:

```js
mainWindow.webContents.on("before-input-event", (event, input) => {
  if (input.control && input.shift && input.key.toLowerCase() === "f12" && input.type === "keyDown") {
    mainWindow.webContents.send("kiosk:open-technical-mode");
    event.preventDefault();
  }
});
```

- [ ] **Step 3: Expose safe APIs in preload**

In `electron/preload.cjs`, add:

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fanframeKiosk", {
  loadDeviceIdentity: () => ipcRenderer.invoke("kiosk:load-device-identity"),
  saveDeviceIdentity: (identity) => ipcRenderer.invoke("kiosk:save-device-identity", identity),
  clearDeviceIdentity: () => ipcRenderer.invoke("kiosk:clear-device-identity"),
  getTechnicalStatus: () => ipcRenderer.invoke("kiosk:get-technical-status"),
  relaunch: () => ipcRenderer.invoke("kiosk:relaunch"),
  onOpenTechnicalMode: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kiosk:open-technical-mode", listener);
    return () => ipcRenderer.removeListener("kiosk:open-technical-mode", listener);
  },
});
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: root build passes.

- [ ] **Step 5: Commit**

```bash
git add electron/main.cjs electron/preload.cjs src/types/kiosk.d.ts
git commit -m "feat: add kiosk local identity bridge"
```

---

### Task 6: Kiosk Pairing Screen, Health Loop, And Command Loop

**Files:**
- Modify: `src/pages/Kiosk.tsx`
- Modify: `src/lib/kiosk.ts`

- [ ] **Step 1: Add API helpers to `src/lib/kiosk.ts`**

Add:

```ts
import { supabase } from "@/integrations/supabase/client";

export async function redeemInstallCode(installCode: string, fingerprint: string, appVersion: string) {
  const { data, error } = await supabase.functions.invoke("redeem-kiosk-install-code", {
    body: { installCode: normalizeInstallCode(installCode), fingerprint, appVersion },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Pairing failed");
  return data;
}

export async function reportKioskHealth(identity: DeviceIdentity, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("report-kiosk-health", {
    headers: buildDeviceAuthHeaders(identity),
    body,
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Health report failed");
  return data;
}

export async function pollKioskCommand(identity: DeviceIdentity, complete?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("poll-kiosk-commands", {
    headers: buildDeviceAuthHeaders(identity),
    body: complete || {},
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Command poll failed");
  return data?.command || null;
}
```

- [ ] **Step 2: Add pairing state to `src/pages/Kiosk.tsx`**

Add state:

```ts
const [identity, setIdentity] = useState<StoredDeviceIdentity | null>(null);
const [pairingCode, setPairingCode] = useState("");
const [pairingError, setPairingError] = useState("");
const [technicalOpen, setTechnicalOpen] = useState(false);
```

Load identity on mount:

```ts
useEffect(() => {
  window.fanframeKiosk?.loadDeviceIdentity().then((stored) => {
    if (stored) setIdentity(stored);
  });
}, []);
```

- [ ] **Step 3: Render first-run pairing screen before customer flow**

Add before the normal kiosk screen:

```tsx
if (!identity) {
  return (
    <main className="kiosk-pairing">
      <section className="kiosk-pairing-panel">
        <p className="eyebrow">FanFrame Totem</p>
        <h1>Conectar este totem</h1>
        <p>Digite o codigo de instalacao enviado pelo administrador.</p>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setPairingError("");
          try {
            const status = await window.fanframeKiosk?.getTechnicalStatus();
            const paired = await redeemInstallCode(pairingCode, navigator.userAgent, status?.appVersion || "dev");
            const stored = {
              deviceId: paired.device.id,
              deviceCode: paired.device.deviceCode,
              deviceSecret: paired.deviceSecret,
              teamSlug: paired.team?.slug,
              pairedAt: new Date().toISOString(),
            };
            await window.fanframeKiosk?.saveDeviceIdentity(stored);
            setIdentity(stored);
          } catch (error) {
            setPairingError(error instanceof Error ? error.message : "Codigo invalido.");
          }
        }}>
          <input value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} placeholder="Ex: RECIFE-001" autoFocus />
          <button>Conectar</button>
        </form>
        {pairingError && <div className="kiosk-error">{pairingError}</div>}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add health loop**

Add:

```ts
useEffect(() => {
  if (!identity) return;
  let lastReportAt: number | null = null;
  const interval = window.setInterval(async () => {
    if (!shouldReportHealth(lastReportAt, 60_000)) return;
    lastReportAt = Date.now();
    const status = await window.fanframeKiosk?.getTechnicalStatus();
    await reportKioskHealth(identity, {
      health: {
        appVersion: status?.appVersion || "dev",
        online: status?.online ?? navigator.onLine,
        currentScreen: "idle",
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      event: { eventType: "health_reported", severity: "info" },
    }).catch(() => undefined);
  }, 10_000);
  return () => window.clearInterval(interval);
}, [identity]);
```

- [ ] **Step 5: Add command loop**

Add:

```ts
useEffect(() => {
  if (!identity) return;
  const interval = window.setInterval(async () => {
    const command = await pollKioskCommand(identity).catch(() => null);
    if (!command) return;
    try {
      if (command.command_type === "sync_config") window.location.reload();
      if (command.command_type === "restart_app") await window.fanframeKiosk?.relaunch();
      if (command.command_type === "enter_maintenance") setMaintenanceMode(true);
      if (command.command_type === "exit_maintenance") setMaintenanceMode(false);
      if (command.command_type === "send_diagnostics") {
        await reportKioskHealth(identity, {
          health: await window.fanframeKiosk?.getTechnicalStatus(),
          event: { eventType: "diagnostics_sent", severity: "info" },
        });
      }
      await pollKioskCommand(identity, { completeCommandId: command.id, success: true, result: { handledAt: new Date().toISOString() } });
    } catch (error) {
      await pollKioskCommand(identity, {
        completeCommandId: command.id,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Command failed",
      }).catch(() => undefined);
    }
  }, 15_000);
  return () => window.clearInterval(interval);
}, [identity]);
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm run test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Kiosk.tsx src/lib/kiosk.ts
git commit -m "feat: add kiosk pairing and operations loop"
```

---

### Task 7: Technical Mode UI

**Files:**
- Modify: `src/pages/Kiosk.tsx`
- Modify: `src/index.css` or the current kiosk stylesheet used by `Kiosk.tsx`

- [ ] **Step 1: Add technical mode listener**

In `src/pages/Kiosk.tsx`:

```ts
useEffect(() => {
  return window.fanframeKiosk?.onOpenTechnicalMode(() => setTechnicalOpen(true));
}, []);
```

- [ ] **Step 2: Add PIN gate**

Add state:

```ts
const [pinInput, setPinInput] = useState("");
const [technicalUnlocked, setTechnicalUnlocked] = useState(false);
const supportPin = "4821";
```

Render modal:

```tsx
{technicalOpen && (
  <div className="technical-overlay">
    <section className="technical-panel">
      {!technicalUnlocked ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (pinInput === supportPin) setTechnicalUnlocked(true);
        }}>
          <h2>Modo tecnico</h2>
          <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN" type="password" />
          <button>Entrar</button>
          <button type="button" onClick={() => setTechnicalOpen(false)}>Cancelar</button>
        </form>
      ) : (
        <div>
          <h2>Diagnostico do totem</h2>
          <button onClick={() => window.location.reload()}>Sincronizar agora</button>
          <button onClick={() => window.fanframeKiosk?.relaunch()}>Reiniciar app</button>
          <button onClick={() => setTechnicalOpen(false)}>Voltar ao totem</button>
        </div>
      )}
    </section>
  </div>
)}
```

- [ ] **Step 3: Add production note in code**

Above `const supportPin = "4821";`, add:

```ts
// MVP fallback. In production this should come from a hashed device-level PIN.
```

- [ ] **Step 4: Add CSS**

Add:

```css
.technical-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.78);
}

.technical-panel {
  width: min(720px, calc(100vw - 48px));
  background: #111827;
  color: #f9fafb;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 28px;
}

.technical-panel form,
.technical-panel div {
  display: grid;
  gap: 16px;
}
```

- [ ] **Step 5: Verify portrait build**

Run:

```bash
npm run build
```

Expected: build passes and the modal CSS does not affect the customer flow when closed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Kiosk.tsx src/index.css
git commit -m "feat: add kiosk technical mode"
```

---

### Task 8: Owner Installation Guide

**Files:**
- Create: `docs/kiosk-installation-owner-guide.md`
- Modify: `README.md`

- [ ] **Step 1: Create the owner guide**

Create `docs/kiosk-installation-owner-guide.md`:

```md
# Guia De Instalacao Do Dono Do Totem

## O Que Voce Precisa

- PC Windows ligado ao totem.
- Internet estavel.
- Webcam conectada.
- Maquininha PagBank/PlugPag configurada quando houver pagamento por cartao.
- Codigo de instalacao enviado pelo administrador FanFrame.

## Primeiro Acesso

1. Instale o FanFrame Kiosk.
2. Abra o aplicativo.
3. Digite o codigo de instalacao.
4. Confirme o time e local exibidos.
5. Aguarde a tela inicial do totem.

## Testes Locais

Abra o modo tecnico com `Ctrl + Shift + F12` e digite o PIN informado pelo administrador.

Use:

- Testar internet.
- Testar camera.
- Testar pagamento.
- Sincronizar agora.
- Reiniciar app.

## Quando Chamar Suporte

Informe o codigo de erro exibido:

- `NET-001`: internet indisponivel.
- `CAM-001`: camera nao encontrada.
- `PAY-001`: pagamento indisponivel.
- `CFG-001`: configuracao nao sincronizada.
- `IA-001`: geracao de imagem indisponivel.

Nao altere arquivos internos do aplicativo. As configuracoes do time, preco e IA sao controladas remotamente pelo administrador FanFrame.
```

- [ ] **Step 2: Link the guide in README**

Add to `README.md`:

```md
## Operacao De Totens

- Guia tecnico: `docs/kiosk-totem.md`
- Guia do dono do totem: `docs/kiosk-installation-owner-guide.md`
- Plano de rede gerenciada: `docs/superpowers/specs/2026-05-10-kiosk-network-operations-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/kiosk-installation-owner-guide.md README.md
git commit -m "docs: add kiosk owner installation guide"
```

---

### Task 9: Verification And Deployment

**Files:**
- No new files.

- [ ] **Step 1: Run root tests**

Run:

```bash
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Build kiosk app**

Run:

```bash
npm run build
```

Expected: Vite production build passes.

- [ ] **Step 3: Build admin app**

Run:

```bash
npm run admin:build
```

Expected: admin Vite production build passes.

- [ ] **Step 4: Deploy Edge Functions**

Run:

```bash
supabase functions deploy redeem-kiosk-install-code
supabase functions deploy report-kiosk-health
supabase functions deploy poll-kiosk-commands
```

Expected: all functions deploy.

- [ ] **Step 5: Push to GitHub**

Run:

```bash
git push origin main
```

Expected: GitHub repo `fanframe-ai/fanframe-totem` receives the new commits and Vercel redeploys `apps/admin`.

- [ ] **Step 6: Manual acceptance test**

Use this checklist:

```md
- Admin creates a device for one team.
- Admin generates an installation code.
- Fresh kiosk app shows pairing screen.
- Installation code pairs the kiosk.
- Kiosk locks to the assigned team.
- Admin sees device online within 60 seconds.
- Admin sends `sync_config`; kiosk handles it.
- Admin sends `enter_maintenance`; kiosk blocks customer flow.
- Admin sends `exit_maintenance`; kiosk returns to customer flow.
- Technical mode opens with `Ctrl + Shift + F12`.
- Technical mode does not expose prompt, price editing, Supabase keys, Replicate token, or PagBank secrets.
```

---

## Self-Review

- Spec coverage: pairing, roles, health, commands, technical mode, admin operations, security, and owner guide are covered by Tasks 1-9.
- Placeholder scan: no implementation step depends on unspecified files or unnamed functions.
- Type consistency: command names match the schema constraint and admin helper type.
- Scope: auto-update, finance-only role, and owner portal are intentionally outside this MVP plan; the plan creates the foundation they need later.

---

Plan complete and ready for implementation.
