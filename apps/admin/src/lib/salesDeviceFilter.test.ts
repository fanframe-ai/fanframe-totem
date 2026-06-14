import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("filtro de totem nas vendas", () => {
  it("oferece o seletor de totem e filtra as consultas pelo dispositivo", () => {
    expect(appSource).toContain('deviceId: string;');
    expect(appSource).toContain('<option value="">Todos os totens</option>');
    expect(appSource).toContain('sessionQuery = sessionQuery.eq("device_id", filters.deviceId)');
    expect(appSource).toContain('paymentQuery = paymentQuery.eq("device_id", filters.deviceId)');
  });
});
