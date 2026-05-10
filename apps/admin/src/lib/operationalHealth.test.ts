import { describe, expect, it } from "vitest";
import {
  buildDeviceLocationLabel,
  getDeviceVersionStatus,
  getOperationalIssues,
  isDeviceOffline,
} from "./operationalHealth";
import type { KioskDevice } from "./types";

const baseDevice: KioskDevice = {
  id: "device-1",
  team_id: "team-1",
  device_code: "TOTEM-001",
  label: "Totem Recife 01",
  location: "Entrada principal",
  city: "Recife",
  venue: "Shopping Recife",
  status: "active",
  app_version: "0.1.0",
  expected_app_version: "0.1.0",
  last_seen_at: new Date("2026-05-10T12:00:00.000Z").toISOString(),
  config: {},
  created_at: new Date("2026-05-01T12:00:00.000Z").toISOString(),
};

describe("operational health", () => {
  it("marks devices offline after the allowed window", () => {
    expect(isDeviceOffline(baseDevice.last_seen_at, new Date("2026-05-10T12:04:59.000Z").getTime())).toBe(false);
    expect(isDeviceOffline(baseDevice.last_seen_at, new Date("2026-05-10T12:05:01.000Z").getTime())).toBe(true);
  });

  it("detects version drift only when an expected version exists", () => {
    expect(getDeviceVersionStatus(baseDevice)).toBe("atualizado");
    expect(getDeviceVersionStatus({ ...baseDevice, app_version: "0.0.9" })).toBe("desatualizado");
    expect(getDeviceVersionStatus({ ...baseDevice, expected_app_version: null })).toBe("sem alvo");
  });

  it("builds ordered operational issues for a device", () => {
    const issues = getOperationalIssues({
      ...baseDevice,
      app_version: "0.0.9",
      last_error_code: "CAM-001",
      last_seen_at: new Date("2026-05-10T11:50:00.000Z").toISOString(),
      install_status: "not_paired",
    }, new Date("2026-05-10T12:00:00.000Z").getTime());

    expect(issues.map((issue) => issue.type)).toEqual(["offline", "error", "version", "pairing"]);
  });

  it("builds a human location label from city, venue and location", () => {
    expect(buildDeviceLocationLabel(baseDevice)).toBe("Recife - Shopping Recife - Entrada principal");
    expect(buildDeviceLocationLabel({ ...baseDevice, city: null, venue: null, location: null })).toBe("-");
  });
});
