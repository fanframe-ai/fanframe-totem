import type { TeamRow, TeamTutorialAssets } from "./types";

type DesignRecipe = {
  version?: number;
  teamName?: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    priceCents?: number;
  };
  texts?: Record<string, unknown>;
  assets?: {
    logoUrl?: string;
    watermarkUrl?: string;
    beforeImage?: string;
    afterImage?: string;
    kioskBackground?: string;
    waitingVideo?: string;
    deliveryLogo?: string;
  };
  experience?: {
    deliveryMessage?: string;
    deliveryWhatsApp?: string;
    deliveryInstagram?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readColor(value: unknown) {
  const color = readString(value);
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
}

function readPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readTextMap(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>((texts, [key, rawValue]) => {
    const text = readString(rawValue);
    if (text) texts[key] = text;
    return texts;
  }, {});
}

export function applyDesignRecipe(team: Partial<TeamRow>, recipeText: string) {
  let recipe: DesignRecipe;
  try {
    const parsed = JSON.parse(recipeText);
    if (!isRecord(parsed)) throw new Error("Receita invalida");
    recipe = parsed as DesignRecipe;
  } catch {
    return { team, error: "Receita invalida. Confira se o texto e um JSON valido." };
  }

  const tutorialAssets = { ...(team.tutorial_assets || {}) } as TeamTutorialAssets;
  const next: Partial<TeamRow> = { ...team };

  const teamName = readString(recipe.teamName);
  if (teamName) next.name = teamName;

  const primaryColor = readColor(recipe.theme?.primaryColor);
  const secondaryColor = readColor(recipe.theme?.secondaryColor);
  const fontFamily = readString(recipe.theme?.fontFamily);
  const priceCents = readPositiveInteger(recipe.theme?.priceCents);
  if (primaryColor) next.primary_color = primaryColor;
  if (secondaryColor) next.secondary_color = secondaryColor;
  if (fontFamily) next.kiosk_font_family = fontFamily;
  if (priceCents !== undefined) next.kiosk_price_cents = priceCents;

  const texts = readTextMap(recipe.texts);
  if (Object.keys(texts).length) {
    next.text_overrides = { ...(team.text_overrides || {}), ...texts };
  }

  const logoUrl = readString(recipe.assets?.logoUrl);
  const watermarkUrl = readString(recipe.assets?.watermarkUrl);
  if (logoUrl) next.logo_url = logoUrl;
  if (watermarkUrl) next.watermark_url = watermarkUrl;

  const before = readString(recipe.assets?.beforeImage);
  const after = readString(recipe.assets?.afterImage);
  const kioskBackground = readString(recipe.assets?.kioskBackground);
  const waitingVideo = readString(recipe.assets?.waitingVideo);
  const deliveryLogo = readString(recipe.assets?.deliveryLogo);
  const deliveryMessage = readString(recipe.experience?.deliveryMessage);
  const deliveryWhatsApp = readString(recipe.experience?.deliveryWhatsApp);
  const deliveryInstagram = readString(recipe.experience?.deliveryInstagram);
  if (before) tutorialAssets.before = before;
  if (after) tutorialAssets.after = after;
  if (kioskBackground) tutorialAssets.kioskBackground = kioskBackground;
  if (waitingVideo) tutorialAssets.waitingVideo = waitingVideo;
  if (deliveryLogo) tutorialAssets.deliveryLogo = deliveryLogo;
  if (deliveryMessage) tutorialAssets.deliveryMessage = deliveryMessage;
  if (deliveryWhatsApp) tutorialAssets.deliveryWhatsApp = deliveryWhatsApp;
  if (deliveryInstagram) tutorialAssets.deliveryInstagram = deliveryInstagram;
  next.tutorial_assets = tutorialAssets;

  return { team: next, error: "" };
}

export function createDesignRecipeFromTeam(team: Partial<TeamRow>) {
  const tutorialAssets = team.tutorial_assets || {};
  const recipe: DesignRecipe = {
    version: 1,
    teamName: team.name || "",
    theme: {
      primaryColor: team.primary_color || "#050505",
      secondaryColor: team.secondary_color || "#ffffff",
      fontFamily: team.kiosk_font_family || "Inter, system-ui, sans-serif",
      priceCents: Number(team.kiosk_price_cents || 0),
    },
    texts: team.text_overrides || {},
    assets: {
      logoUrl: team.logo_url || "",
      watermarkUrl: team.watermark_url || "",
      beforeImage: typeof tutorialAssets.before === "string" ? tutorialAssets.before : "",
      afterImage: typeof tutorialAssets.after === "string" ? tutorialAssets.after : "",
      kioskBackground: typeof tutorialAssets.kioskBackground === "string" ? tutorialAssets.kioskBackground : "",
      waitingVideo: typeof tutorialAssets.waitingVideo === "string" ? tutorialAssets.waitingVideo : "",
      deliveryLogo: typeof tutorialAssets.deliveryLogo === "string" ? tutorialAssets.deliveryLogo : "",
    },
    experience: {
      deliveryMessage: typeof tutorialAssets.deliveryMessage === "string" ? tutorialAssets.deliveryMessage : "",
      deliveryWhatsApp: typeof tutorialAssets.deliveryWhatsApp === "string" ? tutorialAssets.deliveryWhatsApp : "",
      deliveryInstagram: typeof tutorialAssets.deliveryInstagram === "string" ? tutorialAssets.deliveryInstagram : "",
    },
  };

  return JSON.stringify(recipe, null, 2);
}
