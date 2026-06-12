import { describe, expect, it } from "vitest";
import { selectChecks, type AffectedRule } from "./check-affected.mjs";

const rules: AffectedRule[] = [
  { name: "shared", patterns: ["src/shared/kiosk-ui/**"], checks: ["check:kiosk", "check:admin"] },
  { name: "admin", patterns: ["apps/admin/**"], checks: ["check:admin"] },
  { name: "kiosk", patterns: ["src/**"], checks: ["check:kiosk"] },
  { name: "electron", patterns: ["electron/**"], checks: ["check:electron"] },
  { name: "functions", patterns: ["supabase/**"], checks: ["check:functions"] },
  { name: "global", patterns: ["package.json"], checks: ["check:all"], exclusive: true },
  { name: "tooling", patterns: ["scripts/*.test.ts"], checks: ["test:tooling"] },
  { name: "docs", patterns: ["docs/**", "AGENTS.md"], checks: ["context:check"] },
];

describe("affected checks", () => {
  it("selects both consumers for shared kiosk UI", () => {
    const result = selectChecks(["src/shared/kiosk-ui/KioskVisual.tsx"], rules);
    expect(result.checks).toEqual(["check:kiosk", "check:admin"]);
    expect(result.matches[0].rule).toBe("shared");
  });

  it("deduplicates checks from independent domains", () => {
    const result = selectChecks(["apps/admin/src/App.tsx", "supabase/functions/health-check/index.ts"], rules);
    expect(result.checks).toEqual(["check:admin", "check:functions"]);
  });

  it("escalates global configuration changes to the complete check", () => {
    const result = selectChecks(["package.json", "src/pages/Kiosk.tsx"], rules);
    expect(result.checks).toEqual(["check:all"]);
  });

  it("uses context validation for documentation-only changes", () => {
    const result = selectChecks(["docs/architecture/INDEX.md"], rules);
    expect(result.checks).toEqual(["context:check"]);
  });

  it("handles tooling tests and generated type files without falling back", () => {
    const result = selectChecks([
      "scripts/check-affected.test.ts",
      "src/integrations/supabase/types.ts",
      "src/features/kiosk/AGENTS.md",
    ], rules);
    expect(result.checks).toEqual(["test:tooling", "check:kiosk"]);
    expect(result.unmatched).toEqual([]);
  });

  it("falls back to the complete check for unknown source paths", () => {
    const result = selectChecks(["unknown/runtime.go"], rules);
    expect(result.checks).toEqual(["check:all"]);
    expect(result.unmatched).toEqual(["unknown/runtime.go"]);
  });
});
