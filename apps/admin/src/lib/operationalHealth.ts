import type { KioskDevice } from "./types";

export type OperationalIssueType = "offline" | "error" | "version" | "pairing" | "maintenance" | "payment" | "ai" | "pin";
export type OperationalIssueSeverity = "ok" | "warning" | "danger";

export type OperationalIssue = {
  type: OperationalIssueType;
  severity: OperationalIssueSeverity;
  deviceId: string;
  deviceLabel: string;
  message: string;
};

const OFFLINE_AFTER_MS = 5 * 60 * 1000;
const OFFLINE_DANGER_AFTER_MS = 15 * 60 * 1000;
const REPEATED_AI_ERROR_COUNT = 3;

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

function getPaymentStatus(device: KioskDevice) {
  const health = device.last_health_status || {};
  const paymentStatus = health.paymentStatus;
  if (!paymentStatus || typeof paymentStatus !== "object") return null;
  return paymentStatus as { ready?: unknown; message?: unknown };
}

function minutesWithoutContact(lastSeen: string | null | undefined, now: number) {
  if (!lastSeen) return Number.POSITIVE_INFINITY;
  return now - new Date(lastSeen).getTime();
}

function getRepeatedAiErrorCount(device: KioskDevice) {
  const health = device.last_health_status || {};
  const candidates = [
    health.aiErrorCount,
    health.iaErrorCount,
    health.generationErrorCount,
    health.repeatedAiErrors,
    health.repeatedIaErrors,
  ];
  const count = candidates.find((value) => typeof value === "number");
  return typeof count === "number" ? count : 0;
}

function hasAiLastError(device: KioskDevice) {
  const code = (device.last_error_code || "").toLowerCase();
  const message = (device.last_error_message || "").toLowerCase();
  return code.startsWith("ia") || code.startsWith("ai") || code.includes("generation") || message.includes("ia") || message.includes("ai");
}

export function getOperationalIssues(device: KioskDevice, now = Date.now()): OperationalIssue[] {
  const label = device.label || device.device_code;
  const issues: OperationalIssue[] = [];

  if (isDeviceOffline(device.last_seen_at, now)) {
    const offlineSeverity = minutesWithoutContact(device.last_seen_at, now) > OFFLINE_DANGER_AFTER_MS ? "danger" : "warning";
    issues.push({
      type: "offline",
      severity: offlineSeverity,
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta offline ou sem contato recente.`,
    });
  }

  const repeatedAiErrorCount = getRepeatedAiErrorCount(device);
  const hasAiError = hasAiLastError(device);
  if (repeatedAiErrorCount >= REPEATED_AI_ERROR_COUNT || hasAiError) {
    issues.push({
      type: "ai",
      severity: "danger",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta com falha repetida na IA${repeatedAiErrorCount ? ` (${repeatedAiErrorCount} erros recentes)` : ""}.`,
    });
  }

  if (device.last_error_code && !hasAiError) {
    issues.push({
      type: "error",
      severity: "danger",
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

  if ((device.install_status || "not_paired") !== "paired") {
    issues.push({
      type: "pairing",
      severity: "warning",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} ainda nao esta pareado.`,
    });
  }

  if (!device.support_pin_hash) {
    issues.push({
      type: "pin",
      severity: "warning",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} ainda nao tem PIN tecnico configurado.`,
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

  const paymentStatus = getPaymentStatus(device);
  if (paymentStatus && paymentStatus.ready === false) {
    issues.push({
      type: "payment",
      severity: "danger",
      deviceId: device.id,
      deviceLabel: label,
      message: `${label} esta com pagamento indisponivel: ${String(paymentStatus.message || "sem detalhe")}.`,
    });
  }

  return issues;
}
