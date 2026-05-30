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
  kiosk_brand_label?: string;
  kiosk_total_label?: string;
  kiosk_home_eyebrow?: string;
  kiosk_home_title?: string;
  kiosk_home_title_accent?: string;
  kiosk_home_subtitle?: string;
  kiosk_home_cta?: string;
  kiosk_home_benefit_1?: string;
  kiosk_home_benefit_2?: string;
  kiosk_home_benefit_3?: string;
  kiosk_shirt_step?: string;
  kiosk_shirt_title?: string;
  kiosk_cpf_step?: string;
  kiosk_cpf_title?: string;
  kiosk_cpf_hint?: string;
  kiosk_cpf_error?: string;
  kiosk_cpf_continue?: string;
  kiosk_background_step?: string;
  kiosk_background_title?: string;
  kiosk_payment_step?: string;
  kiosk_payment_title?: string;
  kiosk_payment_pix_cta?: string;
  kiosk_payment_pix_hint?: string;
  kiosk_payment_waiting?: string;
  kiosk_payment_qr_hint?: string;
  kiosk_camera_title?: string;
  kiosk_camera_capture?: string;
  kiosk_camera_retake?: string;
  kiosk_camera_use?: string;
  kiosk_generating_title?: string;
  kiosk_generating_subtitle?: string;
  kiosk_result_title?: string;
  kiosk_result_hint?: string;
  kiosk_result_finish?: string;
  kiosk_cancel?: string;
  kiosk_back?: string;
  kiosk_continue?: string;
  kiosk_pay?: string;
}

export interface TeamWaitingSlide {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface TeamTutorialAssets {
  before?: string;
  after?: string;
  kioskBackground?: string;
  kioskBackgroundVideo?: string;
  homeLayout?: "default" | "campaign_poster";
  homeTitleImage?: string;
  waitingVideo?: string;
  waitingSlides?: TeamWaitingSlide[];
  deliveryLogo?: string;
  deliveryMessage?: string;
  deliveryWhatsApp?: string;
  deliveryInstagram?: string;
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
  tutorial_assets: TeamTutorialAssets;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: TeamTextOverrides;
  kiosk_font_family?: string | null;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
  kiosk_currency: string;
  kiosk_timeout_seconds: number;
  kiosk_camera_countdown_seconds: number;
  kiosk_default_mode: string;
  kiosk_show_shirt_step: boolean;
  kiosk_show_background_step: boolean;
  published_config_version?: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTutorialAssets(value: unknown): TeamTutorialAssets {
  if (!isRecord(value)) return {};

  const waitingSlides = Array.isArray(value.waitingSlides)
    ? value.waitingSlides
        .filter(isRecord)
        .map((slide, index) => ({
          id: String(slide.id || `slide-${index + 1}`),
          title: String(slide.title || ""),
          subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
          imageUrl: typeof slide.imageUrl === "string" ? slide.imageUrl : "",
        }))
        .filter((slide) => slide.title || slide.subtitle || slide.imageUrl)
    : [];

  return {
    before: typeof value.before === "string" ? value.before : "",
    after: typeof value.after === "string" ? value.after : "",
    kioskBackground: typeof value.kioskBackground === "string" ? value.kioskBackground : "",
    kioskBackgroundVideo: typeof value.kioskBackgroundVideo === "string" ? value.kioskBackgroundVideo : "",
    homeLayout: value.homeLayout === "campaign_poster" ? "campaign_poster" : "default",
    homeTitleImage: typeof value.homeTitleImage === "string" ? value.homeTitleImage : "",
    waitingVideo: typeof value.waitingVideo === "string" ? value.waitingVideo : "",
    waitingSlides,
    deliveryLogo: typeof value.deliveryLogo === "string" ? value.deliveryLogo : "",
    deliveryMessage: typeof value.deliveryMessage === "string" ? value.deliveryMessage : "",
    deliveryWhatsApp: typeof value.deliveryWhatsApp === "string" ? value.deliveryWhatsApp : "",
    deliveryInstagram: typeof value.deliveryInstagram === "string" ? value.deliveryInstagram : "",
  };
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

        const publicTeamFields = `
          id,
          slug,
          name,
          subdomain,
          shirts,
          backgrounds,
          tutorial_assets,
          primary_color,
          secondary_color,
          logo_url,
          watermark_url,
          is_active,
          text_overrides,
          kiosk_font_family,
          published_config,
          published_config_version,
          kiosk_enabled,
          kiosk_price_cents,
          kiosk_currency,
          kiosk_timeout_seconds,
          kiosk_camera_countdown_seconds,
          kiosk_default_mode,
          kiosk_show_shirt_step,
          kiosk_show_background_step
        `;

        let { data, error: fetchError } = await supabase
          .from("teams")
          .select(publicTeamFields)
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();

        if (!data && !fetchError) {
          const result = await supabase
            .from("teams")
            .select(publicTeamFields)
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

        const published = isRecord(data.published_config) && Object.keys(data.published_config).length > 0
          ? data.published_config
          : {};
        const view = {
          ...data,
          ...published,
          tutorial_assets: {
            ...(isRecord(data.tutorial_assets) ? data.tutorial_assets : {}),
            ...(isRecord(published.tutorial_assets) ? published.tutorial_assets : {}),
          },
          text_overrides: {
            ...(isRecord(data.text_overrides) ? data.text_overrides : {}),
            ...(isRecord(published.text_overrides) ? published.text_overrides : {}),
          },
        };

        const teamConfig: TeamConfig = {
          id: data.id,
          slug: data.slug,
          name: String(view.name || data.name),
          subdomain: data.subdomain,
          replicate_api_token: null,
          generation_prompt: typeof view.generation_prompt === "string" ? view.generation_prompt : null,
          shirts: (view.shirts as unknown as TeamShirt[]) || [],
          backgrounds: (view.backgrounds as unknown as TeamBackground[]) || [],
          tutorial_assets: normalizeTutorialAssets(view.tutorial_assets),
          primary_color: String(view.primary_color || "#000000"),
          secondary_color: String(view.secondary_color || "#FFFFFF"),
          logo_url: typeof view.logo_url === "string" ? view.logo_url : null,
          watermark_url: typeof view.watermark_url === "string" ? view.watermark_url : null,
          is_active: data.is_active ?? true,
          text_overrides: (view.text_overrides as TeamTextOverrides) || {},
          kiosk_font_family: typeof view.kiosk_font_family === "string" ? view.kiosk_font_family : "Inter, system-ui, sans-serif",
          kiosk_enabled: Boolean(view.kiosk_enabled ?? false),
          kiosk_price_cents: Number(view.kiosk_price_cents ?? 2500),
          kiosk_currency: String(view.kiosk_currency || "BRL"),
          kiosk_timeout_seconds: Number(view.kiosk_timeout_seconds ?? 60),
          kiosk_camera_countdown_seconds: Number(view.kiosk_camera_countdown_seconds ?? 5),
          kiosk_default_mode: String(view.kiosk_default_mode || "standard"),
          kiosk_show_shirt_step: Boolean(view.kiosk_show_shirt_step ?? true),
          kiosk_show_background_step: Boolean(view.kiosk_show_background_step ?? true),
          published_config_version: data.published_config_version ?? 1,
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
