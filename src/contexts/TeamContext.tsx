import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamShirt {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  promptDescription: string;
}

export interface TeamBackground {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
}

export interface TeamTextOverrides {
  welcome_title?: string;
  welcome_subtitle?: string;
  welcome_cta?: string;
  welcome_social_proof?: string;
  tutorial_title?: string;
  tutorial_subtitle?: string;
  shirt_title?: string;
  background_title?: string;
  upload_title?: string;
  upload_subtitle?: string;
  upload_cta?: string;
}

export interface TeamConfig {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: TeamShirt[];
  backgrounds: TeamBackground[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: TeamTextOverrides;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
  kiosk_currency: string;
  kiosk_timeout_seconds: number;
  kiosk_default_mode: string;
  kiosk_show_shirt_step: boolean;
  kiosk_show_background_step: boolean;
}

interface TeamContextValue {
  team: TeamConfig | null;
  isLoading: boolean;
  error: string | null;
  setSlug: (slug: string) => void;
}

const TeamContext = createContext<TeamContextValue>({
  team: null,
  isLoading: true,
  error: null,
  setSlug: () => {},
});

export function useTeam() {
  return useContext(TeamContext);
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<TeamConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setTeam(null);
      setIsLoading(false);
      return;
    }

    const loadTeam = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("[TeamContext] Loading team for slug:", slug);

        let { data, error: fetchError } = await supabase
          .from("teams")
          .select("*")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (!data && !fetchError) {
          const result = await supabase
            .from("teams")
            .select("*")
            .eq("subdomain", slug)
            .eq("is_active", true)
            .maybeSingle();
          data = result.data;
          fetchError = result.error;
        }

        if (fetchError) {
          console.error("[TeamContext] Error fetching team:", fetchError);
          setError("Erro ao carregar configuração do time");
          setIsLoading(false);
          return;
        }

        if (!data) {
          console.error("[TeamContext] Team not found for slug:", slug);
          setError("Time não encontrado");
          setIsLoading(false);
          return;
        }

        const teamConfig: TeamConfig = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          subdomain: data.subdomain,
          replicate_api_token: data.replicate_api_token,
          generation_prompt: data.generation_prompt,
          shirts: (data.shirts as unknown as TeamShirt[]) || [],
          backgrounds: (data.backgrounds as unknown as TeamBackground[]) || [],
          tutorial_assets: (data.tutorial_assets as { before: string; after: string }) || { before: "", after: "" },
          primary_color: data.primary_color || "#000000",
          secondary_color: data.secondary_color || "#FFFFFF",
          logo_url: data.logo_url,
          watermark_url: data.watermark_url,
          is_active: data.is_active ?? true,
          text_overrides: (data.text_overrides as TeamTextOverrides) || {},
          kiosk_enabled: data.kiosk_enabled ?? false,
          kiosk_price_cents: data.kiosk_price_cents ?? 2500,
          kiosk_currency: data.kiosk_currency || "BRL",
          kiosk_timeout_seconds: data.kiosk_timeout_seconds ?? 60,
          kiosk_default_mode: data.kiosk_default_mode || "standard",
          kiosk_show_shirt_step: data.kiosk_show_shirt_step ?? true,
          kiosk_show_background_step: data.kiosk_show_background_step ?? true,
        };

        console.log("[TeamContext] Team loaded:", teamConfig.name);
        setTeam(teamConfig);
      } catch (err) {
        console.error("[TeamContext] Unexpected error:", err);
        setError("Erro inesperado ao carregar time");
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
  }, [slug]);

  return (
    <TeamContext.Provider value={{ team, isLoading, error, setSlug }}>
      {children}
    </TeamContext.Provider>
  );
}
