export type Role = "admin" | "super_admin" | "support" | "finance";
export type InstallStatus = "not_paired" | "paired" | "revoked";
export type CommandStatus = "pending" | "running" | "succeeded" | "failed" | "expired";
export type CommandType = "sync_config" | "enter_maintenance" | "exit_maintenance" | "send_diagnostics" | "restart_app" | "update_app";

export interface TeamAsset {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl: string;
  assetPath: string;
  promptDescription?: string;
  visible?: boolean;
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
  waitingVideo?: string;
  waitingSlides?: TeamWaitingSlide[];
  deliveryLogo?: string;
  deliveryMessage?: string;
  deliveryWhatsApp?: string;
  deliveryInstagram?: string;
  [key: string]: unknown;
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
  tutorial_assets: TeamTutorialAssets;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: Record<string, string>;
  kiosk_font_family: string | null;
  draft_config: Record<string, unknown>;
  published_config: Record<string, unknown>;
  published_config_version: number;
  published_at: string | null;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
  kiosk_currency: string;
  kiosk_timeout_seconds: number;
  kiosk_camera_countdown_seconds: number;
  kiosk_default_mode: string;
  kiosk_show_shirt_step: boolean;
  kiosk_show_background_step: boolean;
}

export interface KioskDeviceConfig {
  updateInstallerUrl?: string;
  updates?: {
    installerUrl?: string;
    updateArgs?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KioskDevice {
  id: string;
  team_id: string;
  device_code: string;
  label: string | null;
  location: string | null;
  city?: string | null;
  venue?: string | null;
  installation_notes?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  install_status?: InstallStatus;
  paired_at?: string | null;
  config_version?: number;
  expected_app_version?: string | null;
  update_channel?: "stable" | "beta" | "maintenance";
  support_pin_hash?: string | null;
  last_health_at?: string | null;
  last_health_status?: Record<string, unknown>;
  last_error_code?: string | null;
  last_error_message?: string | null;
  maintenance_reason?: string | null;
  status: "active" | "maintenance" | "disabled";
  app_version: string | null;
  last_seen_at: string | null;
  config: KioskDeviceConfig;
  created_at: string;
  teams?: { name: string; slug: string } | null;
}

export interface KioskDeviceEvent {
  id: string;
  device_id: string | null;
  team_id: string | null;
  session_id: string | null;
  event_type: string;
  severity: "debug" | "info" | "warning" | "error" | "critical";
  error_code: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface KioskDeviceCommand {
  id: string;
  device_id: string;
  command_type: CommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  result: Record<string, unknown>;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  expires_at: string;
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
