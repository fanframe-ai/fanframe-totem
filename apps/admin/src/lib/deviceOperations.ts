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
  await logAdminAudit("kiosk_devices", deviceId, "install_code_created", { label, expiresAt });
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
  await logAdminAudit("kiosk_devices", deviceId, "remote_command_enqueued", { commandType, payload });

  if (commandType === "enter_maintenance") {
    await supabase
      .from("kiosk_devices")
      .update({ status: "maintenance", maintenance_reason: String(payload.reason || "Manutencao remota") })
      .eq("id", deviceId);
    await logAdminAudit("kiosk_devices", deviceId, "maintenance_enabled", { reason: payload.reason || "Manutencao remota" });
  }

  if (commandType === "exit_maintenance") {
    await supabase
      .from("kiosk_devices")
      .update({ status: "active", maintenance_reason: null })
      .eq("id", deviceId);
    await logAdminAudit("kiosk_devices", deviceId, "maintenance_disabled", {});
  }
}

export async function logAdminAudit(targetTable: string, targetId: string | null, action: string, payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const actorUserId = sessionData.session?.user.id;
  if (!actorUserId) return;

  const { error } = await supabase.from("kiosk_admin_audit_events").insert({
    actor_user_id: actorUserId,
    target_table: targetTable,
    target_id: targetId,
    action,
    payload,
  });
  if (error) console.warn("[audit]", error.message);
}
