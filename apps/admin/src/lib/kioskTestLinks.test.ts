import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("./deviceOperations.ts", import.meta.url), "utf8");

describe("links de teste por totem", () => {
  it("permite criar, copiar, abrir e desativar o link", () => {
    expect(app).toContain("Criar link de teste");
    expect(app).toContain("Copiar link");
    expect(app).toContain("Abrir teste");
    expect(app).toContain("Desativar link");
  });

  it("usa a Edge Function autenticada e uma origem configuravel", () => {
    expect(operations).toContain('functions.invoke("manage-kiosk-test-links"');
    expect(app).toContain("VITE_KIOSK_TEST_ORIGIN");
    expect(app).toContain("/teste-totem/");
  });
});
