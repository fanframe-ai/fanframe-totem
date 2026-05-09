// FanFrame asset configuration
// Static asset URLs and helpers used by the wizard.

import { SUPABASE_URL } from "@/integrations/supabase/client";

// Background interface (kept for backward compat, re-exported from TeamContext types)
export interface Background {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
}

// Supabase Storage base URL
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/tryon-assets`;

// Legacy ASSET_URLS - kept as fallback, but TeamContext is the source of truth
export const ASSET_URLS = {
  background: `${STORAGE_BASE}/backgrounds/mural.png`,
  shirts: {
    "manto-1": `${STORAGE_BASE}/shirts/manto-1.png`,
    "manto-2": `${STORAGE_BASE}/shirts/manto-2.png`,
    "manto-3": `${STORAGE_BASE}/shirts/manto-3.png`,
  },
  backgrounds: {
    "mural": `${STORAGE_BASE}/backgrounds/mural.png`,
    "memorial": `${STORAGE_BASE}/backgrounds/memorial.jpg`,
    "idolos": `${STORAGE_BASE}/backgrounds/idolos.jpg`,
    "trofeus": `${STORAGE_BASE}/backgrounds/trofeus.jpg`,
  },
  tutorial: {
    before: `${STORAGE_BASE}/tutorial/before.jpg`,
    after: `${STORAGE_BASE}/tutorial/after.png`,
  },
} as const;

// Legacy BACKGROUNDS array - components should use useTeam().team.backgrounds instead
export const BACKGROUNDS: Background[] = [
  {
    id: "mural",
    name: "Mural dos Ídolos",
    subtitle: "Os maiores craques do Corinthians",
    imageUrl: ASSET_URLS.backgrounds["mural"],
    assetPath: ASSET_URLS.backgrounds["mural"],
  },
  {
    id: "memorial",
    name: "Memorial do Corinthians",
    subtitle: "A história do Timão",
    imageUrl: ASSET_URLS.backgrounds["memorial"],
    assetPath: ASSET_URLS.backgrounds["memorial"],
  },
  {
    id: "idolos",
    name: "Galeria dos Ídolos",
    subtitle: "Os maiores ídolos corintianos",
    imageUrl: ASSET_URLS.backgrounds["idolos"],
    assetPath: ASSET_URLS.backgrounds["idolos"],
  },
  {
    id: "trofeus",
    name: "Sala de Troféus",
    subtitle: "A história em conquistas",
    imageUrl: ASSET_URLS.backgrounds["trofeus"],
    assetPath: ASSET_URLS.backgrounds["trofeus"],
  },
];

// Helper para obter URL completa de um asset
export const getAssetFullUrl = (assetPath: string): string => {
  if (assetPath.startsWith('http')) {
    return assetPath;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${assetPath}`;
  }
  return assetPath;
};
