export type Role = "admin" | "super_admin";

export interface TeamAsset {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl: string;
  assetPath: string;
  promptDescription?: string;
  visible?: boolean;
}

export interface TeamRow {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: TeamAsset[];
  backgrounds: TeamAsset[];
  tutorial_assets: Record<string, string>;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
  kiosk_currency: string;
  kiosk_timeout_seconds: number;
  kiosk_default_mode: string;
  kiosk_show_shirt_step: boolean;
  kiosk_show_background_step: boolean;
}

export interface KioskDevice {
  id: string;
  team_id: string;
  device_code: string;
  label: string | null;
  location: string | null;
  status: "active" | "maintenance" | "disabled";
  app_version: string | null;
  last_seen_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  teams?: { name: string; slug: string } | null;
}

export interface KioskSession {
  id: string;
  team_id: string;
  device_id: string | null;
  payment_id: string | null;
  generation_queue_id: string | null;
  status: string;
  selected_shirt_id: string | null;
  selected_background_id: string | null;
  amount_cents: number;
  currency: string;
  result_image_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  teams?: { name: string; slug: string } | null;
  kiosk_devices?: { device_code: string; label: string | null; location: string | null } | null;
}

export interface KioskPayment {
  id: string;
  session_id: string;
  team_id: string;
  device_id: string | null;
  provider: string;
  method: string;
  status: string;
  amount_cents: number;
  currency: string;
  reference_id: string;
  pagbank_order_id: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  teams?: { name: string; slug: string } | null;
}
