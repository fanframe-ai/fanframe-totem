# Kiosk Paid Session Generation Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que uma venda PIX confirmada no totem nunca fique presa em `paid` sem geracao, e que qualquer erro real fique persistido e recuperavel.

**Architecture:** O kiosk deve tratar pagamento confirmado como estado duravel: se a IA falhar antes de criar `generation_queue`, a sessao deve ser marcada como falha recuperavel com erro tecnico, e o usuario deve conseguir tentar novamente sem pagar de novo. A Edge Function `generate-tryon` deve criar ou atualizar rastros operacionais desde o inicio da chamada, antes do upload da foto, para que falhas antes da fila nao sumam. O painel deve expor sessoes pagas sem geracao como problema operacional e permitir recuperacao.

**Tech Stack:** React/Vite, Electron kiosk Windows, Supabase Postgres/RLS, Supabase Edge Functions, Vitest.

---

## Incident Summary

Root evidence from production:

- Device: `TOTEM - MUSEU FLAMENGO`
- Device id: `5c2ff097-e77a-43b8-8708-3d0476da6b19`
- Session: `89d83360-2f15-4f09-abcb-c699daf7dd88`
- Payment: `9150e745-7a4c-42bd-ac37-1f5e708532f3`
- Paid at: `2026-06-24 14:38:25.811+00`
- Shirt: `1987`
- Final persisted session status: `paid`
- `generation_queue_id`: `null`
- No row in `generation_queue`
- No row in `generations`
- Kiosk health sequence: `shirt -> home -> cpf -> camera -> camera -> recovery-cpf`

Conclusion: the customer paid and reached camera, but generation was not enqueued. The system currently has no durable trace for failures that happen before queue creation, and the UI can fall back to `APP-001`.

## Files

- Modify: `src/pages/Kiosk.tsx`
  - Add retry/recovery state for paid sessions.
  - Persist generation-start failures through a new Edge Function call.
  - Avoid resetting away a paid session without offering retry/recovery.
- Modify: `src/lib/kiosk.ts`
  - Add typed helpers for session failure reporting and paid-session recovery.
  - Improve `classifyKioskError` so generation-start failures show `IA-001` or a specific recoverable code instead of `APP-001`.
- Create: `src/lib/kioskPaidGenerationRecovery.test.ts`
  - Structural and behavior tests for paid session invariants.
- Modify: `supabase/functions/generate-tryon/index.ts`
  - Mark `kiosk_sessions.status = 'generating'` before risky work when a paid kiosk session id is provided.
  - On any error, update that same session to `failed` with `error_message`, preserving `payment_id`.
  - Log `source`, `kiosk_session_id`, and `payment_id` correctly in the catch path.
- Create: `supabase/functions/mark-kiosk-session-error/index.ts`
  - Authenticated device function to persist client-side generation-start failures that happen before or around `generate-tryon`.
- Modify: `supabase/config.toml`
  - Register `mark-kiosk-session-error`.
- Create: `supabase/functions/mark-kiosk-session-error/index.test.ts`
  - Contract test by source inspection for device auth and safe updates.
- Modify: `supabase/functions/recover-kiosk-photos/index.ts`
  - Include paid failed sessions without result as retry candidates, not only completed photos.
- Modify: `apps/admin/src/App.tsx`
  - Surface paid sessions without generation as an urgent problem.
- Create: `apps/admin/src/lib/paidStuckSessions.test.ts`
  - Admin structural test for the new operational alert.
- Modify: `docs/release-automation.md`
  - Add release note/checklist item for stuck paid session recovery.

---

### Task 1: Lock the Paid-Session Invariant in Tests

**Files:**
- Create: `src/lib/kioskPaidGenerationRecovery.test.ts`

- [ ] Create the test file with these assertions:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("paid kiosk generation recovery", () => {
  it("does not leave a paid kiosk session untracked when generation start fails", () => {
    const kiosk = source("../pages/Kiosk.tsx");

    expect(kiosk).toContain("markKioskSessionError");
    expect(kiosk).toContain("Erro ao iniciar geracao da foto");
    expect(kiosk).toContain("retryPaidGeneration");
  });

  it("classifies generation start failures as IA errors instead of generic APP errors", () => {
    const kioskLib = source("./kiosk.ts");

    expect(kioskLib).toContain("generation_start_failed");
    expect(kioskLib).toContain("geracao da foto");
  });

  it("the generate-tryon catch path preserves kiosk session context", () => {
    const edgeFunction = source("../../supabase/functions/generate-tryon/index.ts");

    expect(edgeFunction).toContain("let requestContext");
    expect(edgeFunction).toContain("kiosk_session_id: requestContext.kioskSessionId");
    expect(edgeFunction).toContain("payment_id: requestContext.paymentId");
    expect(edgeFunction).toContain("status: \"failed\"");
    expect(edgeFunction).toContain("error_message:");
  });
});
```

- [ ] Run the new test and confirm it fails:

```powershell
npm run test:kiosk -- src/lib/kioskPaidGenerationRecovery.test.ts
```

Expected: FAIL because `markKioskSessionError`, `retryPaidGeneration`, and `requestContext` do not exist yet.

- [ ] Commit only the failing test if working with commits:

```powershell
git add src/lib/kioskPaidGenerationRecovery.test.ts
git commit -m "test: lock paid kiosk generation recovery invariant"
```

---

### Task 2: Persist Client-Side Generation Start Failures

**Files:**
- Modify: `src/lib/kiosk.ts`
- Create: `supabase/functions/mark-kiosk-session-error/index.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/functions/mark-kiosk-session-error/index.test.ts`

- [ ] Add helper types and function to `src/lib/kiosk.ts`:

```ts
export async function markKioskSessionError(
  identity: DeviceIdentity,
  body: {
    session_id: string;
    payment_id?: string | null;
    error_code: string;
    error_message: string;
    step?: string;
  },
) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("mark-kiosk-session-error", {
    headers: buildDeviceAuthHeaders(identity),
    body,
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Nao foi possivel registrar o erro da sessao.");
  return data as { ok: true };
}
```

- [ ] Extend `classifyKioskError` in `src/lib/kiosk.ts` before the generic fallback:

```ts
if (
  text.includes("generation_start_failed") ||
  text.includes("geracao da foto") ||
  text.includes("geracao") ||
  text.includes("generate-tryon")
) {
  return {
    code: "IA-001",
    title: "Geracao indisponivel",
    action: "Nao cobre novamente. Tente gerar a foto outra vez ou chame o suporte.",
  };
}
```

- [ ] Create `supabase/functions/mark-kiosk-session-error/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kiosk-device-code, x-kiosk-device-secret",
};

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing Supabase environment");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function hashSecret(secret: string) {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const deviceCode = req.headers.get("x-kiosk-device-code") || "";
    const deviceSecret = req.headers.get("x-kiosk-device-secret") || "";
    if (!deviceCode || !deviceSecret) {
      return new Response(JSON.stringify({ error: "Missing device auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    const paymentId = typeof body.payment_id === "string" ? body.payment_id : null;
    const errorCode = typeof body.error_code === "string" ? body.error_code : "generation_start_failed";
    const errorMessage = typeof body.error_message === "string" ? body.error_message : "Erro ao iniciar geracao da foto.";
    const step = typeof body.step === "string" ? body.step : "generating";

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const deviceSecretHash = await hashSecret(deviceSecret);
    const { data: device, error: deviceError } = await supabase
      .from("kiosk_devices")
      .select("id, team_id, status, install_status, device_secret_hash")
      .eq("device_code", deviceCode)
      .maybeSingle();

    if (deviceError || !device || device.device_secret_hash !== deviceSecretHash || device.status !== "active" || device.install_status !== "paired") {
      return new Response(JSON.stringify({ error: "Device not authorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("kiosk_sessions")
      .update({
        status: "failed",
        error_message: errorMessage,
        metadata: {
          error_code: errorCode,
          failed_step: step,
          payment_id: paymentId,
          recoverable_paid_generation: true,
        },
      })
      .eq("id", sessionId)
      .eq("device_id", device.id)
      .eq("team_id", device.team_id)
      .neq("status", "completed");

    if (updateError) throw updateError;

    await supabase.from("kiosk_device_events").insert({
      device_id: device.id,
      team_id: device.team_id,
      session_id: sessionId,
      event_type: "generation_start_failed",
      severity: "error",
      error_code: errorCode,
      message: errorMessage,
      payload: { step, payment_id: paymentId },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[mark-kiosk-session-error]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] Add to `supabase/config.toml`:

```toml
[functions.mark-kiosk-session-error]
verify_jwt = false
```

- [ ] Create `supabase/functions/mark-kiosk-session-error/index.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("mark-kiosk-session-error contract", () => {
  it("requires device auth and only updates the authenticated device session", () => {
    expect(source).toContain("x-kiosk-device-code");
    expect(source).toContain("x-kiosk-device-secret");
    expect(source).toContain(".eq(\"device_id\", device.id)");
    expect(source).toContain(".eq(\"team_id\", device.team_id)");
  });

  it("marks paid generation failures as recoverable and logs a device event", () => {
    expect(source).toContain("recoverable_paid_generation");
    expect(source).toContain("generation_start_failed");
    expect(source).toContain("kiosk_device_events");
  });
});
```

- [ ] Run:

```powershell
npx vitest run supabase/functions/mark-kiosk-session-error/index.test.ts src/lib/kioskPaidGenerationRecovery.test.ts
```

Expected after implementation: PASS for the new function contract; kiosk recovery test may still fail until Task 3.

---

### Task 3: Make the Kiosk Retry Generation After a Paid Failure

**Files:**
- Modify: `src/pages/Kiosk.tsx`
- Test: `src/lib/kioskPaidGenerationRecovery.test.ts`

- [ ] Import the new helper:

```ts
import {
  classifyKioskError,
  createRecoveredPhotoLink,
  friendlyPaymentError,
  markKioskSessionError,
  pollKioskCommand,
  pollKioskState,
  recoverKioskPhoto,
} from "@/lib/kiosk";
```

Use the actual existing import block and add only `markKioskSessionError`.

- [ ] Add a retry function near `startGeneration`:

```ts
const retryPaidGeneration = () => {
  if (!sessionId || !paymentId || !userImage) {
    resetFlow();
    return;
  }
  setError(null);
  generationSettledRef.current = false;
  void startGeneration();
};
```

- [ ] Wrap the `generate-tryon` call in `startGeneration` with `try/catch`:

```ts
let responseData: unknown = null;
let responseError: unknown = null;

try {
  const { data, error: fnError } = await supabase.functions.invoke("generate-tryon", {
    body: {
      userImageBase64: userImage,
      shirtAssetUrl: getAssetFullUrl(selectedShirt.assetPath),
      backgroundAssetUrl: getAssetFullUrl(backgroundForGeneration.assetPath),
      shirtId: selectedShirt.id,
      team_slug: team.slug,
      kiosk_session_id: sessionId,
      payment_id: paymentId,
      source: isWebTestMode ? "web_test" : "kiosk",
    },
  });
  responseData = data;
  responseError = fnError;
} catch (generationError) {
  responseError = generationError;
}

const data = responseData as { queueId?: string; error?: string; generationId?: string; stage?: string } | null;
const rawMessage = data?.error || (responseError instanceof Error ? responseError.message : "Erro ao iniciar geracao da foto.");

if (responseError || data?.error || !data?.queueId) {
  const message = `generation_start_failed: ${rawMessage}`;
  if (hasDeviceAuth) {
    await markKioskSessionError(activeDevice, {
      session_id: sessionId,
      payment_id: paymentId,
      error_code: "generation_start_failed",
      error_message: message,
      step: "generating",
    }).catch(() => undefined);
  }
  setError(message);
  setStep("maintenance");
  return;
}

setQueueId(data.queueId);
```

- [ ] In the maintenance UI, show retry when there is a paid session and photo still in memory:

```tsx
{sessionId && paymentId && userImage && maintenanceError?.code === "IA-001" && (
  <KioskButton onClick={retryPaidGeneration} className="w-full mb-4">
    Tentar gerar novamente
  </KioskButton>
)}
```

Place it before the generic `Tentar novamente` button.

- [ ] Run:

```powershell
npm run test:kiosk -- src/lib/kioskPaidGenerationRecovery.test.ts
```

Expected: PASS.

- [ ] Run broader kiosk checks:

```powershell
npm run typecheck:kiosk
npm run test:kiosk
```

Expected: PASS.

---

### Task 4: Make `generate-tryon` Persist Failures Before Queue Creation

**Files:**
- Modify: `supabase/functions/generate-tryon/index.ts`
- Test: `src/lib/kioskPaidGenerationRecovery.test.ts`

- [ ] Add request context near handler variables:

```ts
let requestContext: {
  kioskSessionId: string | null;
  paymentId: string | null;
  source: "web" | "kiosk" | "web_test";
  shirtId: string | null;
  teamId: string | null;
} = {
  kioskSessionId: null,
  paymentId: null,
  source: "web",
  shirtId: null,
  teamId: null,
};
```

- [ ] After parsing `requestSource`, assign context:

```ts
requestContext = {
  kioskSessionId: kiosk_session_id || null,
  paymentId: payment_id || null,
  source: requestSource,
  shirtId: shirtId || null,
  teamId: null,
};
```

- [ ] After resolving `teamId`, update context and mark the session as generating before creating the queue:

```ts
requestContext.teamId = teamId;

if ((requestSource === "kiosk" || requestSource === "web_test") && kiosk_session_id) {
  await supabase
    .from("kiosk_sessions")
    .update({
      status: "generating",
      error_message: null,
      payment_id: payment_id || null,
    })
    .eq("id", kiosk_session_id);
}
```

- [ ] Replace the catch-path `logGeneration` payload with context-preserving values:

```ts
await logGeneration(supabase, generationId, {
  shirt_id: requestContext.shirtId || "unknown",
  status: "failed",
  team_id: requestContext.teamId,
  kiosk_session_id: requestContext.kioskSessionId,
  payment_id: requestContext.paymentId,
  source: requestContext.source,
  error_message: error instanceof Error ? error.message : "Unknown error",
  processing_time_ms: processingTime,
});
```

- [ ] In the catch path, update the kiosk session if present:

```ts
if (requestContext.kioskSessionId && (requestContext.source === "kiosk" || requestContext.source === "web_test")) {
  await supabase
    .from("kiosk_sessions")
    .update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
    .eq("id", requestContext.kioskSessionId);
}
```

- [ ] Run:

```powershell
npm run test:kiosk -- src/lib/kioskPaidGenerationRecovery.test.ts
npm run check:functions
```

Expected: PASS.

---

### Task 5: Expose Paid-Stuck Sessions in Admin

**Files:**
- Modify: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/lib/paidStuckSessions.test.ts`

- [ ] Create `apps/admin/src/lib/paidStuckSessions.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("paid stuck kiosk sessions", () => {
  it("surfaces paid sessions without generation as urgent operational problems", () => {
    expect(app).toContain("Pago sem geracao");
    expect(app).toContain("generation_queue_id");
    expect(app).toContain("status === \"paid\"");
    expect(app).toContain("payment_status");
  });
});
```

- [ ] Modify the admin problem builder in `apps/admin/src/App.tsx` to include:

```ts
const paidWithoutGeneration = sessions.filter((session) =>
  session.status === "paid" &&
  !session.generation_queue_id &&
  session.payment_status === "paid"
);
```

If the current session type nests payment status differently, use the existing selected session fields from the sessions query and add the missing select alias.

- [ ] Add an urgent problem item:

```tsx
paidWithoutGeneration.map((session) => ({
  priority: "urgent",
  title: "Pago sem geracao",
  description: `${deviceLabel(session)} recebeu pagamento, mas nao iniciou geracao.`,
  label: deviceLabel(session),
  href: `/sessoes/${session.id}`,
}))
```

Adapt to the current problem-list structure in `App.tsx`.

- [ ] Run:

```powershell
npm --prefix apps/admin run test -- src/lib/paidStuckSessions.test.ts
npm --prefix apps/admin run check
```

Expected: PASS.

---

### Task 6: Recovery Search Must Find Paid Failed Sessions

**Files:**
- Modify: `supabase/functions/recover-kiosk-photos/index.ts`

- [ ] Update recovery search so it distinguishes two result types:

```ts
type RecoveryStatus = "completed" | "paid_failed";
```

- [ ] Include sessions where payment is paid but no result exists:

```ts
.in("status", ["completed", "failed", "paid"])
```

- [ ] Filter returned rows so paid failures have:

```ts
const isPaidFailed =
  session.status !== "completed" &&
  session.kiosk_payments?.status === "paid" &&
  !session.result_image_url;
```

- [ ] Return paid failed entries with a retry-oriented label:

```ts
{
  sessionId: session.id,
  createdAt: session.created_at,
  imageUrl: session.result_image_url,
  status: isPaidFailed ? "paid_failed" : "completed",
  label: isPaidFailed ? "Pagamento encontrado. Gere novamente no suporte." : "Foto pronta",
}
```

- [ ] Do not let the public user download a missing image. Only allow `createRecoveredPhotoLink` for completed rows with `result_image_url`.

- [ ] Add a structural test if the function has no runtime test yet:

```powershell
npx vitest run supabase/functions/recover-kiosk-photos/index.test.ts
```

If no test exists, create one by source inspection requiring `paid_failed`, `kiosk_payments`, and blocking link creation without `result_image_url`.

---

### Task 7: Operational Backfill and One-Time Cleanup

**Files:**
- No committed code required unless creating a script.

- [ ] Run a read-only query to list stuck real paid sessions:

```sql
select
  ks.id as session_id,
  kd.label,
  ks.created_at,
  kp.paid_at,
  ks.selected_shirt_id,
  kp.id as payment_id,
  kp.provider,
  kp.status as payment_status
from public.kiosk_sessions ks
join public.kiosk_devices kd on kd.id = ks.device_id
join public.kiosk_payments kp on kp.id = ks.payment_id
where kp.status = 'paid'
  and kp.provider <> 'simulated'
  and ks.generation_queue_id is null
  and ks.status in ('paid', 'failed')
order by ks.created_at desc;
```

- [ ] For historical rows, do not fabricate generations. Mark them as recoverable operational failures:

```sql
update public.kiosk_sessions ks
set
  status = 'failed',
  error_message = coalesce(ks.error_message, 'Pagamento confirmado, mas geracao nao foi iniciada. Recuperacao manual necessaria.'),
  metadata = coalesce(ks.metadata, '{}'::jsonb) || jsonb_build_object(
    'recoverable_paid_generation', true,
    'backfilled_at', now(),
    'backfill_reason', 'paid_without_generation_queue'
  )
from public.kiosk_payments kp
where kp.id = ks.payment_id
  and kp.status = 'paid'
  and kp.provider <> 'simulated'
  and ks.generation_queue_id is null
  and ks.status = 'paid';
```

- [ ] Insert admin-visible events for the affected device sessions:

```sql
insert into public.kiosk_device_events (
  device_id,
  team_id,
  session_id,
  event_type,
  severity,
  error_code,
  message,
  payload
)
select
  ks.device_id,
  ks.team_id,
  ks.id,
  'paid_without_generation_backfill',
  'error',
  'paid_without_generation',
  'Pagamento confirmado sem fila de geracao.',
  jsonb_build_object('payment_id', ks.payment_id, 'selected_shirt_id', ks.selected_shirt_id)
from public.kiosk_sessions ks
join public.kiosk_payments kp on kp.id = ks.payment_id
where kp.status = 'paid'
  and kp.provider <> 'simulated'
  and ks.generation_queue_id is null
  and ks.metadata ->> 'backfill_reason' = 'paid_without_generation_queue';
```

- [ ] Save the before/after row counts in the incident notes or admin ticket.

---

### Task 8: Verification and Release

**Files:**
- Modify: `docs/release-automation.md`

- [ ] Add a release checklist bullet:

```md
- Verificar que uma sessao PIX paga nao fica em `paid` sem `generation_queue_id`; falhas antes da fila devem virar `failed` com `recoverable_paid_generation = true`.
```

- [ ] Run affected checks:

```powershell
npm run check:kiosk
npm run check:functions
npm run check:admin
npm run context:check
```

Expected: PASS.

- [ ] Deploy Supabase functions:

```powershell
npx supabase functions deploy generate-tryon --project-ref dzfbjscrpxhpyeimggut
npx supabase functions deploy mark-kiosk-session-error --project-ref dzfbjscrpxhpyeimggut
npx supabase functions deploy recover-kiosk-photos --project-ref dzfbjscrpxhpyeimggut
```

- [ ] Deploy admin/kiosk web as applicable through the existing GitHub/Vercel flow.

- [ ] If the Windows kiosk app changed and must run on the museum totem, create a kiosk release:

```powershell
npm run release:kiosk
```

- [ ] Manual production test on a test totem:

1. Start a PIX test flow where payment is simulated only in test mode.
2. Confirm a normal generation creates `generation_queue_id`.
3. Temporarily force `generate-tryon` failure in a non-production test environment.
4. Confirm session becomes `failed`, keeps `payment_id`, and has `recoverable_paid_generation = true`.
5. Confirm kiosk shows retry without asking for another payment.
6. Confirm admin shows "Pago sem geracao" for any remaining stuck paid session.

---

## Self-Review

- Spec coverage: covers the incident root cause, user-facing retry, durable backend logging, admin visibility, historical cleanup, deployment, and Windows release path.
- Placeholder scan: no `TBD` or open-ended "handle errors" steps remain.
- Type consistency: `markKioskSessionError`, `generation_start_failed`, `recoverable_paid_generation`, and `retryPaidGeneration` are used consistently across tasks.
