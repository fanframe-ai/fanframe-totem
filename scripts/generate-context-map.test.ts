import { describe, expect, it } from "vitest";
import {
  buildContextMap,
  classifyDomain,
  shouldIncludeFile,
  type ContextFile,
} from "./generate-context-map.mjs";

describe("generate context map", () => {
  it("ignores generated, secret and high-noise files", () => {
    expect(shouldIncludeFile("src/pages/Kiosk.tsx")).toBe(true);
    expect(shouldIncludeFile("node_modules/react/index.js")).toBe(false);
    expect(shouldIncludeFile("dist/assets/index.js")).toBe(false);
    expect(shouldIncludeFile("release/FanFrame.exe")).toBe(false);
    expect(shouldIncludeFile("package-lock.json")).toBe(false);
    expect(shouldIncludeFile(".env")).toBe(false);
    expect(shouldIncludeFile("docs/archive/plans/old.md")).toBe(false);
  });

  it("classifies files into stable product domains", () => {
    expect(classifyDomain("apps/admin/src/App.tsx")).toBe("Admin remoto");
    expect(classifyDomain("src/shared/kiosk-ui/KioskVisual.tsx")).toBe("UI compartilhada");
    expect(classifyDomain("src/pages/Kiosk.tsx")).toBe("Kiosk runtime");
    expect(classifyDomain("supabase/functions/generate-tryon/index.ts")).toBe("Supabase");
    expect(classifyDomain("electron/main.cjs")).toBe("Electron");
  });

  it("produces a concise deterministic markdown index", () => {
    const files: ContextFile[] = [
      { path: "src/pages/Kiosk.tsx", lines: 1721, exports: ["default Kiosk"] },
      { path: "apps/admin/src/App.tsx", lines: 3487, exports: ["default App"] },
      { path: "src/lib/kiosk.test.ts", lines: 50, exports: [] },
    ];

    const output = buildContextMap(files, { generatedAt: "static" });

    expect(output).toContain("## Admin remoto");
    expect(output).toContain("## Kiosk runtime");
    expect(output).toContain("`src/pages/Kiosk.tsx` | 1721");
    expect(output).toContain("Testes proximos: `src/lib/kiosk.test.ts`");
    expect(output.split("\n").length).toBeLessThan(80);
    expect(output).not.toContain("package-lock");
  });
});
