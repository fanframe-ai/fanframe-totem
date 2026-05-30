import { describe, expect, it } from "vitest";
import { applyDesignRecipe, createDesignRecipeFromTeam } from "./designRecipe";
import type { TeamRow } from "./types";

const baseTeam = {
  name: "Flamengo",
  primary_color: "#000000",
  secondary_color: "#ffffff",
  kiosk_font_family: "Inter, system-ui, sans-serif",
  kiosk_price_cents: 2500,
  text_overrides: {
    kiosk_home_title: "Vista o manto",
  },
  tutorial_assets: {
    before: "old-before.jpg",
  },
} as Partial<TeamRow>;

describe("admin design recipes", () => {
  it("applies safe JSON recipe fields to the team draft", () => {
    const recipe = JSON.stringify({
      version: 1,
      teamName: "Mengao",
      theme: {
        primaryColor: "#e10600",
        secondaryColor: "#ffffff",
        fontFamily: "Oswald, Inter, system-ui, sans-serif",
        priceCents: 3000,
      },
      texts: {
        kiosk_home_title: "Entre no clima rubro-negro",
        kiosk_home_cta: "Comecar",
      },
      assets: {
        logoUrl: "logo.png",
        beforeImage: "before.png",
        afterImage: "after.png",
        kioskBackground: "bg.png",
        kioskBackgroundVideo: "home-bg.mp4",
      },
    });

    const result = applyDesignRecipe(baseTeam, recipe);

    expect(result.error).toBe("");
    expect(result.team.name).toBe("Mengao");
    expect(result.team.primary_color).toBe("#e10600");
    expect(result.team.kiosk_font_family).toBe("Oswald, Inter, system-ui, sans-serif");
    expect(result.team.kiosk_price_cents).toBe(3000);
    expect(result.team.text_overrides).toMatchObject({
      kiosk_home_title: "Entre no clima rubro-negro",
      kiosk_home_cta: "Comecar",
    });
    expect(result.team.tutorial_assets).toMatchObject({
      before: "before.png",
      after: "after.png",
      kioskBackground: "bg.png",
      kioskBackgroundVideo: "home-bg.mp4",
    });
    expect(result.team.logo_url).toBe("logo.png");
  });

  it("rejects invalid JSON without changing the team", () => {
    const result = applyDesignRecipe(baseTeam, "{invalid");

    expect(result.error).toContain("JSON");
    expect(result.team).toEqual(baseTeam);
  });

  it("exports the current team as a reusable recipe", () => {
    const recipe = JSON.parse(createDesignRecipeFromTeam(baseTeam));

    expect(recipe.version).toBe(1);
    expect(recipe.teamName).toBe("Flamengo");
    expect(recipe.theme.primaryColor).toBe("#000000");
    expect(recipe.texts.kiosk_home_title).toBe("Vista o manto");
    expect(recipe.assets.beforeImage).toBe("old-before.jpg");
  });
});
