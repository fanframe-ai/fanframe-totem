import type { KioskDevice } from "./types";

export type OperationalIssueType = "offline" | "error" | "version" | "pairing" | "maintenance";
export type OperationalIssueSeverity = "warning" | "critical";

export type OperationalIssue = {
  type: OperationalIssueType;
  severity: OperationalIssueSeverity;
  deviceId: string;
  deviceLabel: string;
  message: string;
};

const OFFLINE_AFTER_MS = 5 * 60 * 1000;

export function isDeviceOffline(lastSeen: string | null | undefined, now = Date.now()) {
  if (!lastSeen) return true;
  return now - new Date(lastSeen).getTime() > OFFLINE_AFTER_MS;
}

export function getDeviceVersionStatus(device: Pick<KioskDevice, "app_version" | "expected_app_version">) {
  if (!device.expected_app_version) return "sem alvo";
  if (!device.app_version) return "sem versao";
  return device.app_version === device.expected_app_version ? "atualizado" : "desatualizado";
}

export function buildDeviceLocationLabel(device: Pick<KioskDevice, "city" | "venue" | "location">) {
  const parts = [device.city, device.venue, device.location].map((part) => part?.trim()).filter(Boolean);
  return parts.length ? parts.join(" - ") : "-";
}

export function getOperationalIssues(device: KioskDevice, now = Date.now()): OperationalIssue[] {
  const label = device.label || device.device_code;
  const issues: OperationalIssue[] = [];

  if (isDeviceOffline(device.last_seen_at, now)) {
    issues.push({
      type: "offline",
      severity: "critical",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta offline ou sem contato recente.`,
    });
  }

  if (device.last_error_code) {
    issues.push({
      type: "error",
      severity: "critical",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} reportou erro ${device.last_error_code}: ${device.last_error_message || "sem detalhe"}.`,
    });
  }

  if (getDeviceVersionStatus(device) === "desatualizado") {
    issues.push({
      type: "version",
      severity: "warning",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta na versao ${device.app_version || "-"}; esperado ${device.expected_app_version}.`,
    });
  }

  if (device.install_status && device.install_status !== "paired") {
    issues.push({
      type: "pairing",
      severity: "warning",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} ainda nao esta pareado.`,
    });
  }

  if (device.status === "maintenance") {
    issues.push({
      type: "maintenance",
      severity: "warning",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta em manutencao${device.maintenance_reason ? `: ${device.maintenance_reason}` : "."}`,
    });
  }

  return issues;
}
