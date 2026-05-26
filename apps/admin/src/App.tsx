import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Code2,
  Copy,
  Cpu,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MousePointer2,
  Palette,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Shirt,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import { supabase, publicAssetUrl, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./lib/supabase";
import { createInstallCode, enqueueDeviceCommand, logAdminAudit, rotateDeviceSupportPin, sha256 } from "./lib/deviceOperations";
import { buildOwnerInstallMessage, buildOwnerUpdateMessage } from "./lib/installInstructions";
import { applyDesignRecipe, createDesignRecipeFromTeam } from "./lib/designRecipe";
import {
  KioskCameraVisual,
  KioskGeneratingVisual,
  KioskHomeVisual,
  KioskPaymentVisual,
  KioskResultVisual,
  KioskSelectionVisual,
  KioskVisualShell,
} from "../../../src/shared/kiosk-ui/KioskVisual";
import {
  buildDeviceLocationLabel,
  getDeviceVersionStatus,
  getOperationalIssues,
  isDeviceOffline,
} from "./lib/operationalHealth";
import type {
  CommandType,
  KioskDevice,
  KioskDeviceCommand,
  KioskDeviceEvent,
  KioskPayment,
  KioskSession,
  Role,
  TeamAsset,
  TeamRow,
  TeamTutorialAssets,
  TeamWaitingSlide,
} from "./lib/types";

type AuthState = {
  loading: boolean;
  user: User | null;
  role: Role | null;
  error: string | null;
};

type Filters = {
  teamId: string;
  status: string;
  days: number;
};

type AdminAuditEvent = {
  id: string;
  actor_user_id: string | null;
  target_table: string;
  target_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type ConsentLogRow = {
  id: string;
  team_id: string | null;
  user_id: string;
  consent_type: string;
  consent_text: string;
  accepted_at: string;
  teams?: { name: string; slug: string } | null;
};

type GenerationQueueRow = {
  id: string;
  source: string | null;
  status: string;
  shirt_id: string | null;
  error_message: string | null;
  created_at: string;
  result_image_url: string | null;
  teams?: { name: string; slug: string } | null;
};

type SystemAlertRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
};

type AdminUserRow = {
  id: string;
  email: string;
  role: Role;
  created_at: string;
};

const emptyTeam: Partial<TeamRow> = {
  name: "",
  slug: "",
  subdomain: "",
  replicate_api_token: null,
  generation_prompt: "",
  shirts: [],
  backgrounds: [],
  tutorial_assets: { waitingSlides: [] },
  primary_color: "#111827",
  secondary_color: "#ffffff",
  logo_url: null,
  watermark_url: null,
  is_active: true,
  text_overrides: {},
  kiosk_font_family: "Inter, system-ui, sans-serif",
  draft_config: {},
  published_config: {},
  published_config_version: 1,
  published_at: null,
  kiosk_enabled: true,
  kiosk_price_cents: 2500,
  kiosk_currency: "BRL",
  kiosk_timeout_seconds: 60,
  kiosk_camera_countdown_seconds: 5,
  kiosk_default_mode: "standard",
  kiosk_show_shirt_step: true,
  kiosk_show_background_step: true,
};

const assetLimits = {
  imageMaxMb: 8,
  videoMaxMb: 80,
  videoRecommendedSeconds: 30,
  videoRecommendedRatio: "9:16",
};

function getKioskPreviewUrl(teamSlug?: string | null) {
  return teamSlug ? `/kiosk?team_slug=${encodeURIComponent(teamSlug)}` : "/kiosk";
}

function getKioskRuntimePreviewUrl(teamSlug?: string | null) {
  const configuredOrigin = String(import.meta.env.VITE_KIOSK_PREVIEW_ORIGIN || "").replace(/\/$/, "");
  const localDevOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : "";
  const origin = configuredOrigin || localDevOrigin;
  if (!origin) return "";
  const params = new URLSearchParams({ preview: "admin" });
  if (teamSlug) params.set("team_slug", teamSlug);
  return `${origin}/kiosk?${params.toString()}`;
}

function getDeviceInstallerUrl(device?: Pick<KioskDevice, "config"> | null) {
  if (!device?.config) return "";
  if (typeof device.config.updates?.installerUrl === "string") return device.config.updates.installerUrl;
  if (typeof device.config.updateInstallerUrl === "string") return device.config.updateInstallerUrl;
  return "";
}

type KioskTextField = {
  key: string;
  label: string;
  placeholder: string;
  long?: boolean;
};

const kioskTextGroups: Array<{ title: string; description: string; fields: KioskTextField[] }> = [
  {
    title: "Topo do app",
    description: "Textos pequenos que ficam fixos na parte de cima da tela.",
    fields: [
      { key: "kiosk_brand_label", label: "Nome pequeno no canto", placeholder: "FanFrame Totem" },
      { key: "kiosk_total_label", label: "Texto acima do valor", placeholder: "Total" },
    ],
  },
  {
    title: "Tela inicial",
    description: "Primeira tela que o cliente ve antes de comecar.",
    fields: [
      { key: "kiosk_home_eyebrow", label: "Texto pequeno acima do titulo", placeholder: "Experiencia interativa" },
      { key: "kiosk_home_title", label: "Titulo principal", placeholder: "Vista o manto" },
      { key: "kiosk_home_subtitle", label: "Frase explicando o que acontece", placeholder: "Escolha sua camisa, pague no totem e receba sua foto por QR Code.", long: true },
      { key: "kiosk_home_cta", label: "Botao para iniciar", placeholder: "Comecar" },
    ],
  },
  {
    title: "Escolha do cliente",
    description: "Telas de camisa, cenario e botoes de navegacao.",
    fields: [
      { key: "kiosk_shirt_step", label: "Passo da camisa", placeholder: "Passo 1 de 3" },
      { key: "kiosk_shirt_title", label: "Titulo da camisa", placeholder: "Escolha a camisa" },
      { key: "kiosk_background_step", label: "Passo do cenario", placeholder: "Passo 2 de 3" },
      { key: "kiosk_background_title", label: "Titulo do cenario", placeholder: "Escolha o cenario" },
      { key: "kiosk_cancel", label: "Botao cancelar", placeholder: "Cancelar" },
      { key: "kiosk_back", label: "Botao voltar", placeholder: "Voltar" },
      { key: "kiosk_continue", label: "Botao continuar", placeholder: "Continuar" },
      { key: "kiosk_pay", label: "Botao pagar", placeholder: "Pagar" },
    ],
  },
  {
    title: "Pagamento PIX",
    description: "Textos exibidos na etapa de pagamento.",
    fields: [
      { key: "kiosk_payment_step", label: "Passo do pagamento", placeholder: "Passo 3 de 3" },
      { key: "kiosk_payment_title", label: "Titulo do pagamento", placeholder: "Pagamento" },
      { key: "kiosk_payment_pix_cta", label: "Botao PIX", placeholder: "Pagar com PIX" },
      { key: "kiosk_payment_pix_hint", label: "Ajuda antes do QR Code", placeholder: "Aponte a camera do celular para o QR Code.", long: true },
      { key: "kiosk_payment_waiting", label: "Texto aguardando", placeholder: "Aguardando pagamento" },
      { key: "kiosk_payment_qr_hint", label: "Ajuda abaixo do QR Code", placeholder: "Aponte a camera do celular para pagar com PIX.", long: true },
    ],
  },
  {
    title: "Foto e resultado",
    description: "Textos da camera, geracao da imagem e entrega final.",
    fields: [
      { key: "kiosk_camera_title", label: "Titulo da camera", placeholder: "Sua foto" },
      { key: "kiosk_camera_capture", label: "Botao capturar", placeholder: "Capturar" },
      { key: "kiosk_camera_retake", label: "Botao refazer", placeholder: "Refazer" },
      { key: "kiosk_camera_use", label: "Botao usar foto", placeholder: "Usar foto" },
      { key: "kiosk_generating_title", label: "Titulo enquanto gera", placeholder: "Gerando imagem" },
      { key: "kiosk_generating_subtitle", label: "Frase enquanto gera", placeholder: "Nao feche nem desligue o totem.", long: true },
      { key: "kiosk_result_title", label: "Titulo da entrega", placeholder: "Imagem pronta" },
      { key: "kiosk_result_hint", label: "Frase do QR Code final", placeholder: "Escaneie para baixar no celular", long: true },
      { key: "kiosk_result_finish", label: "Botao finalizar", placeholder: "Finalizar" },
    ],
  },
];

type TeamEditorTab = "basico" | "venda" | "construtor" | "experiencia" | "visual" | "textos" | "camisas" | "cenarios" | "ia" | "avancado";

const teamEditorTabs: Array<{ id: TeamEditorTab; label: string }> = [
  { id: "basico", label: "Basico" },
  { id: "venda", label: "Venda" },
  { id: "construtor", label: "Construtor" },
  { id: "experiencia", label: "Experiencia" },
  { id: "ia", label: "IA" },
  { id: "avancado", label: "Avancado" },
];

function money(cents = 0, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const flamengoToolkitFontFamily = '"Zalando Sans Expanded", Arial, sans-serif';

function isFlamengoTeam(team: Partial<Pick<TeamRow, "name" | "slug">>) {
  return [team.slug, team.name].some((value) => slugify(String(value || "")).includes("flamengo"));
}

function resolveTeamFontFamily(team: Partial<Pick<TeamRow, "name" | "slug" | "kiosk_font_family">>) {
  if (isFlamengoTeam(team)) return flamengoToolkitFontFamily;
  return team.kiosk_font_family || "Inter, system-ui, sans-serif";
}

function isOffline(lastSeen: string | null | undefined) {
  return isDeviceOffline(lastSeen);
}

function deviceHealthLabel(device: KioskDevice) {
  if (device.status === "disabled") return "disabled";
  if (device.status === "maintenance") return "maintenance";
  if (isOffline(device.last_seen_at)) return "offline";
  if (device.last_error_code) return "attention";
  if (getDeviceVersionStatus(device) === "desatualizado") return "update";
  return "online";
}

const friendlyLabels: Record<string, string> = {
  active: "Funcionando",
  admin: "Admin",
  attention: "Com alerta",
  awaiting_payment: "Aguardando pagamento",
  cancelled: "Cancelado",
  capturing: "Tirando foto",
  completed: "Concluido",
  configured: "Configurado",
  critical: "Critico",
  danger: "Urgente",
  debit: "Debito",
  disabled: "Desativado",
  error: "Erro",
  failed: "Com erro",
  finance: "Financeiro",
  generating: "Gerando foto",
  habilitado: "Ligado",
  inativo: "Inativo",
  info: "Informacao",
  ai: "IA",
  kiosk: "Totem",
  maintenance: "Em manutencao",
  not_paired: "Nao instalado",
  offline: "Sem contato",
  ok: "Ok",
  online: "Online",
  paid: "Pago",
  paired: "Instalado",
  pairing: "Instalacao",
  pagbank_pix: "PIX PagBank",
  pending: "Pendente",
  pix: "PIX",
  plugpag: "Cartao",
  pin: "PIN tecnico",
  processing: "Em andamento",
  revoked: "Cancelado",
  running: "Em andamento",
  simulated: "Teste",
  simulated_pix: "PIX teste",
  succeeded: "Concluido",
  super_admin: "Dono",
  support: "Suporte",
  stable: "Producao",
  update: "Precisa atualizar",
  beta: "Teste",
  enter_maintenance: "Pausar vendas",
  exit_maintenance: "Liberar vendas",
  restart_app: "Reiniciar app",
  send_diagnostics: "Pedir diagnostico",
  sync_config: "Atualizar dados",
  version: "Atualizacao",
  warning: "Atencao",
  web: "Site",
  ativo: "Ativo",
  atualizado: "Atualizado",
  configurado: "Configurado",
  desabilitado: "Desligado",
  desatualizado: "Precisa atualizar",
  "nao definido": "Nao definido",
  "sem alvo": "Sem versao desejada",
  "sem versao": "Sem versao informada",
};

function friendly(value: string | null | undefined) {
  if (!value) return "-";
  return friendlyLabels[value] || value.replace(/_/g, " ");
}

function centsToReais(cents: number | null | undefined) {
  return ((cents || 0) / 100).toFixed(2);
}

function reaisToCents(value: string) {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) ? Math.max(0, Math.round(normalized * 100)) : 0;
}

function hasRole(role: Role | null, allowed: Role[]) {
  return Boolean(role && allowed.includes(role));
}

function canManageBusiness(role: Role | null) {
  return hasRole(role, ["super_admin", "admin"]);
}

function canSupportOperations(role: Role | null) {
  return hasRole(role, ["super_admin", "admin", "support"]);
}

function canManageUsers(role: Role | null) {
  return role === "super_admin";
}

type TeamKioskDraft = Pick<TeamRow,
  | "name"
  | "generation_prompt"
  | "shirts"
  | "backgrounds"
  | "tutorial_assets"
  | "primary_color"
  | "secondary_color"
  | "logo_url"
  | "watermark_url"
  | "is_active"
  | "text_overrides"
  | "kiosk_font_family"
  | "kiosk_enabled"
  | "kiosk_price_cents"
  | "kiosk_currency"
  | "kiosk_timeout_seconds"
  | "kiosk_camera_countdown_seconds"
  | "kiosk_default_mode"
  | "kiosk_show_shirt_step"
  | "kiosk_show_background_step"
>;

const kioskDraftKeys: Array<keyof TeamKioskDraft> = [
  "name",
  "generation_prompt",
  "shirts",
  "backgrounds",
  "tutorial_assets",
  "primary_color",
  "secondary_color",
  "logo_url",
  "watermark_url",
  "is_active",
  "text_overrides",
  "kiosk_font_family",
  "kiosk_enabled",
  "kiosk_price_cents",
  "kiosk_currency",
  "kiosk_timeout_seconds",
  "kiosk_camera_countdown_seconds",
  "kiosk_default_mode",
  "kiosk_show_shirt_step",
  "kiosk_show_background_step",
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildKioskDraft(team: Partial<TeamRow>) {
  return kioskDraftKeys.reduce<Record<string, unknown>>((draft, key) => {
    draft[key] = team[key] ?? emptyTeam[key];
    return draft;
  }, {});
}

function mergeKioskDraft(team: Partial<TeamRow>, config: unknown) {
  if (!isObjectRecord(config) || Object.keys(config).length === 0) return team;
  const allowed = kioskDraftKeys.reduce<Record<string, unknown>>((next, key) => {
    if (key in config) next[key] = config[key as string];
    return next;
  }, {});
  return { ...team, ...allowed };
}

function readConsentPayload(consentText: string) {
  try {
    const parsed = JSON.parse(consentText);
    return isObjectRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function hasUnpublishedDraft(team: Partial<TeamRow>) {
  const draft = JSON.stringify(buildKioskDraft(team));
  const published = JSON.stringify(team.published_config || {});
  return draft !== published;
}

async function uploadAsset(file: File, path: string) {
  const { error } = await supabase.storage.from("tryon-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return publicAssetUrl(path);
}

function uniqueAssetPath(teamSlug: string, folder: string, name: string, extension: string) {
  const safeSlug = slugify(teamSlug) || "novo";
  const safeName = slugify(name) || "asset";
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${safeSlug}/${folder}/${safeName}-${Date.now()}.${safeExtension}`;
}

function validateExperienceFile(file: File, kind: "image" | "video") {
  const limitMb = kind === "video" ? assetLimits.videoMaxMb : assetLimits.imageMaxMb;
  const sizeMb = file.size / 1024 / 1024;
  if (sizeMb > limitMb) {
    throw new Error(`Arquivo muito pesado. Limite: ${limitMb} MB.`);
  }
}

function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, user: null, role: null, error: null });

  const loadRole = async (user: User) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin", "support", "finance"]);

    if (error || !data?.length) {
      setAuth({ loading: false, user, role: null, error: "Usuario sem permissao administrativa." });
      return;
    }
    const priority: Role[] = ["super_admin", "admin", "support", "finance"];
    const role = priority.find((candidate) => data.some((row) => row.role === candidate)) || null;
    setAuth({ loading: false, user, role, error: null });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadRole(data.session.user);
      else setAuth({ loading: false, user: null, role: null, error: null });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setTimeout(() => loadRole(session.user), 0);
      else setAuth({ loading: false, user: null, role: null, error: null });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return auth;
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">FanFrame Totens</p>
          <h1>Painel dos totens</h1>
          <p>Controle times, totens, vendas e fotos geradas de qualquer lugar.</p>
        </div>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}

function Protected({ children, auth }: { children: React.ReactNode; auth: AuthState }) {
  if (auth.loading) return <div className="loading">Carregando painel...</div>;
  if (!auth.user || !auth.role) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGate({ role, allowed, children }: { role: Role | null; allowed: Role[]; children: React.ReactNode }) {
  if (!hasRole(role, allowed)) {
    return (
      <>
        <PageHeader title="Acesso restrito" subtitle="Seu perfil nao tem permissao para esta area." />
        <div className="panel empty-state"><Shield size={28} /> Area bloqueada para este usuario.</div>
      </>
    );
  }
  return <>{children}</>;
}

function Layout({ auth, children }: { auth: AuthState; children: React.ReactNode }) {
  const nav = [
    { href: "/", Icon: LayoutDashboard, label: "Inicio", roles: ["super_admin", "admin", "support", "finance"] as Role[] },
    { href: "/times", Icon: Shirt, label: "Times", roles: ["super_admin", "admin"] as Role[] },
    { href: "/totens", Icon: Monitor, label: "Totens", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/sessoes", Icon: Activity, label: "Vendas", roles: ["super_admin", "admin", "support", "finance"] as Role[] },
    { href: "/problemas", Icon: AlertTriangle, label: "Problemas", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/usuarios", Icon: Users, label: "Usuarios", roles: ["super_admin"] as Role[] },
    { href: "/configuracoes", Icon: Settings, label: "Ajustes", roles: ["super_admin", "admin"] as Role[] },
  ].filter((item) => hasRole(auth.role, item.roles));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FF</div>
          <div>
            <strong>FanFrame</strong>
            <span>Painel remoto</span>
          </div>
        </div>
        <nav>
          {nav.map(({ href, Icon, label }) => (
            <NavLink key={href} to={href} end={href === "/"}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{auth.user?.email}</span>
          <strong>{friendly(auth.role)}</strong>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProblemMetricCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: string }) {
  return (
    <Link className={`stat-card problem-link-card ${tone}`} to="/problemas">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>/problemas</small>
    </Link>
  );
}

function useTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("teams").select("*").order("name");
    setTeams((data || []) as TeamRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  return { teams, loading, reload: load };
}

function Dashboard() {
  const { teams } = useTeams();
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [sessions, setSessions] = useState<KioskSession[]>([]);
  const [payments, setPayments] = useState<KioskPayment[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("kiosk_devices").select("*, teams(name, slug)").order("last_seen_at", { ascending: false }),
      supabase.from("kiosk_sessions").select("*, teams(name, slug), kiosk_devices(device_code,label,location)").order("created_at", { ascending: false }).limit(20),
      supabase.from("kiosk_payments").select("*, teams(name, slug)").order("created_at", { ascending: false }).limit(100),
    ]).then(([deviceRes, sessionRes, paymentRes]) => {
      setDevices((deviceRes.data || []) as KioskDevice[]);
      setSessions((sessionRes.data || []) as KioskSession[]);
      setPayments((paymentRes.data || []) as KioskPayment[]);
    });
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const paidToday = payments.filter((p) => p.status === "paid" && new Date(p.paid_at || p.created_at) >= today);
  const revenue = paidToday.reduce((sum, p) => sum + p.amount_cents, 0);
  const operationalIssues = devices.flatMap((device) => getOperationalIssues(device));
  const onlineDevices = devices.filter((d) => deviceHealthLabel(d) === "online").length;
  const offlineDevices = devices.filter((d) => isOffline(d.last_seen_at)).length;
  const paymentIssueCount = operationalIssues.filter((issue) => issue.type === "payment").length;
  const aiIssueCount = operationalIssues.filter((issue) => issue.type === "ai").length;
  const versionIssueCount = operationalIssues.filter((issue) => issue.type === "version").length;

  return (
    <>
      <PageHeader title="Inicio" subtitle="O que precisa de atencao hoje nos seus totens." />
      <section className="dashboard-hero">
        <div>
          <span>Resumo da operacao</span>
          <h2>{operationalIssues.length ? `${operationalIssues.length} ponto${operationalIssues.length > 1 ? "s" : ""} para revisar` : "Tudo tranquilo agora"}</h2>
          <p>{offlineDevices ? `${offlineDevices} totem(ns) sem contato. Veja a fila de problemas antes de mexer em configuracoes.` : "Nenhum totem offline detectado neste momento."}</p>
        </div>
        <div className="dashboard-hero-actions">
          <Link className="primary link-button" to="/problemas">Ver problemas</Link>
          <Link className="secondary link-button" to="/totens">Ver totens</Link>
        </div>
      </section>
      <section className="stats-grid compact-stats">
        <ProblemMetricCard label="Totens sem contato" value={offlineDevices} tone={offlineDevices ? "danger" : "neutral"} />
        <ProblemMetricCard label="Pagamentos com erro" value={paymentIssueCount} tone={paymentIssueCount ? "danger" : "neutral"} />
        <ProblemMetricCard label="IA com falha" value={aiIssueCount} tone={aiIssueCount ? "danger" : "neutral"} />
        <ProblemMetricCard label="Precisam atualizar" value={versionIssueCount} tone={versionIssueCount ? "warning" : "neutral"} />
        <StatCard label="Totens online" value={onlineDevices} tone="success" />
        <StatCard label="Vendas hoje" value={paidToday.length} tone="success" />
        <StatCard label="Receita hoje" value={money(revenue)} tone="success" />
        <StatCard label="Times ativos" value={teams.filter((t) => t.is_active).length} />
      </section>
      <section className="panel">
        <h2>Precisa de atencao</h2>
        {operationalIssues.length > 0 ? (
          <div className="issue-card-list">
            {operationalIssues.slice(0, 8).map((issue) => (
              <article className="issue-card" key={`${issue.deviceId}-${issue.type}`}>
                <div>
                  <Badge value={issue.severity} />
                  <h3>{issue.deviceLabel}</h3>
                  <p>{issue.message}</p>
                </div>
                <Link className="primary link-button" to={`/totens/${issue.deviceId}`}>Abrir</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nenhum problema importante detectado agora.</div>
        )}
      </section>
      <section className="two-col">
        <div className="panel">
          <h2>Vendas recentes</h2>
          <div className="compact-list">
            {sessions.map((s) => (
              <div className="compact-row" key={s.id}>
                <div>
                  <strong>{s.teams?.name || "-"}</strong>
                  <span>{s.kiosk_devices?.label || s.kiosk_devices?.device_code || "-"} - {dateTime(s.created_at)}</span>
                </div>
                <div>
                  <strong>{money(s.amount_cents, s.currency)}</strong>
                  <Badge value={s.status} />
                </div>
              </div>
            ))}
            {sessions.length === 0 && <div className="empty-state">Nenhuma venda recente.</div>}
          </div>
        </div>
        <div className="panel">
          <h2>Totens recentes</h2>
          <div className="compact-list">
            {devices.slice(0, 12).map((d) => (
              <Link className="compact-row" to={`/totens/${d.id}`} key={d.id}>
                <div>
                  <strong>{d.label || d.device_code}</strong>
                  <span>{d.teams?.name || "-"} - {dateTime(d.last_seen_at)}</span>
                </div>
                <Badge value={deviceHealthLabel(d)} />
              </Link>
            ))}
            {devices.length === 0 && <div className="empty-state">Nenhum totem cadastrado.</div>}
          </div>
        </div>
      </section>
    </>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{friendly(value)}</span>;
}

function DataTable({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Teams() {
  const { teams, loading, reload } = useTeams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const filteredTeams = teams.filter((team) => {
    const haystack = [team.name, team.slug, team.subdomain].join(" ").toLowerCase();
    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "selling" && team.kiosk_enabled !== false && team.is_active !== false) ||
      (statusFilter === "paused" && (team.kiosk_enabled === false || team.is_active === false));
    return matchesSearch && matchesStatus;
  });

  async function deleteTeam(team: TeamRow) {
    setMessage("");
    const expected = team.slug || team.name;
    const confirmation = window.prompt(`Para excluir o time "${team.name}", digite exatamente: ${expected}`);
    if (confirmation !== expected) {
      if (confirmation !== null) setMessage("Exclusao cancelada: confirmacao diferente do codigo do time.");
      return;
    }

    const { count, error: countError } = await supabase
      .from("kiosk_devices")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id);

    if (countError) {
      setMessage(countError.message);
      return;
    }
    if ((count || 0) > 0) {
      setMessage(`Esse time ainda tem ${count} totem(ns) vinculado(s). Troque ou exclua os totens antes de apagar o time.`);
      return;
    }

    await logAdminAudit("teams", team.id, "team_deleted", { name: team.name, slug: team.slug });
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) {
      setMessage(`Nao foi possivel excluir o time: ${error.message}`);
      return;
    }

    setMessage(`Time "${team.name}" excluido.`);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Times"
        subtitle="Configure o que cada torcida vai ver no totem."
        action={<Link className="primary link-button" to="/times/novo"><Plus size={16} /> Novo time</Link>}
      />
      <section className="list-toolbar">
        <label>
          Buscar time
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou codigo do time" />
        </label>
        <label>
          Situacao
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos os times</option>
            <option value="selling">Vendendo</option>
            <option value="paused">Pausados</option>
          </select>
        </label>
        <div className="toolbar-count">
          <strong>{filteredTeams.length}</strong>
          <span>{filteredTeams.length === 1 ? "time encontrado" : "times encontrados"}</span>
        </div>
      </section>
      {message && <div className="form-message">{message}</div>}
      <section className="team-card-grid">
        {loading && <div className="panel empty-state">Carregando times...</div>}
        {!loading && filteredTeams.map((team) => (
          <article className="team-card" key={team.id}>
            <div className="team-card-top">
              <div className="team-mark" style={{ background: team.primary_color || "#111827", color: team.secondary_color || "#ffffff" }}>
                {team.logo_url ? <img src={team.logo_url} alt="" /> : team.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2>{team.name}</h2>
                <p>{team.kiosk_enabled ? "Vendendo no totem" : "Venda pausada"}</p>
              </div>
              <Badge value={team.is_active ? "ativo" : "inativo"} />
            </div>
            <div className="team-card-summary">
              <div><span>Preco</span><strong>{money(team.kiosk_price_cents, team.kiosk_currency)}</strong></div>
              <div><span>Camisas</span><strong>{team.shirts?.length || 0}</strong></div>
              <div><span>Cenarios</span><strong>{team.backgrounds?.length || 0}</strong></div>
            </div>
            <div className="team-card-footer">
              <span>{team.slug ? `/${team.slug}` : "Sem codigo"}</span>
              <div className="team-card-actions">
                <Link className="secondary link-button" to={getKioskPreviewUrl(team.slug)}>Ver kiosk online</Link>
                <Link className="primary link-button" to={`/times/${team.slug}`}>Editar time</Link>
                <button className="danger" type="button" onClick={() => deleteTeam(team)}><Trash2 size={14} /> Excluir</button>
              </div>
            </div>
          </article>
        ))}
        {!loading && filteredTeams.length === 0 && (
          <div className="panel empty-state">{teams.length === 0 ? "Nenhum time cadastrado ainda." : "Nenhum time encontrado com esses filtros."}</div>
        )}
      </section>
    </>
  );
}

function KioskOnlinePreview() {
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const teamSlug = new URLSearchParams(window.location.search).get("team_slug") || "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");

    if (!teamSlug) {
      setTeam(null);
      setMessage("Escolha um time no painel para abrir a previa do kiosk.");
      setLoading(false);
      return;
    }

    supabase
      .from("teams")
      .select("*")
      .eq("slug", teamSlug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        setTeam((data || null) as TeamRow | null);
        if (!data && !error) setMessage("Time nao encontrado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [teamSlug]);

  const text = team?.text_overrides || {};
  const tutorialAssets = team?.tutorial_assets || {};
  const beforeImage = publicAssetUrl(tutorialAssets.before || "");
  const afterImage = publicAssetUrl(tutorialAssets.after || "");
  const logoUrl = publicAssetUrl(team?.logo_url || "");
  const previewUrl = `${window.location.origin}${getKioskPreviewUrl(teamSlug)}`;

  return (
    <>
      <PageHeader
        title="Preview do kiosk"
        subtitle="Veja como a tela inicial aparece para esse time."
        action={
          <div className="page-actions">
            <Link className="secondary link-button" to="/times">Voltar aos times</Link>
            <button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(previewUrl)}>Copiar link</button>
          </div>
        }
      />

      {loading && <section className="panel empty-state">Carregando preview...</section>}
      {!loading && message && <section className="panel empty-state">{message}</section>}
      {!loading && team && (
        <section className="kiosk-online-preview-shell">
          <div
            className="kiosk-online-preview"
            style={{
              fontFamily: resolveTeamFontFamily(team),
              borderColor: team.primary_color || "#ffffff",
            }}
          >
            <header className="kiosk-online-header">
              <div>
                <span>{text.kiosk_brand_label || "FanFrame Totem"}</span>
                <strong>{team.name}</strong>
              </div>
              {logoUrl && <img src={logoUrl} alt="" />}
              <div className="kiosk-online-price">
                <span>{text.kiosk_total_label || "Total"}</span>
                <strong>{money(team.kiosk_price_cents, team.kiosk_currency)}</strong>
              </div>
            </header>
            <main className="kiosk-online-home">
              <div className="kiosk-online-copy">
                <span>{text.kiosk_home_eyebrow || "Experiencia interativa"}</span>
                <h2>{text.kiosk_home_title || "Vista o manto"}</h2>
                <p>{text.kiosk_home_subtitle || "Escolha sua camisa, pague no totem e receba sua foto por QR Code."}</p>
              </div>
              <div className="kiosk-online-before-after">
                <article>
                  <span>Antes</span>
                  {beforeImage ? <img src={beforeImage} alt="Antes" /> : <div>Sem imagem</div>}
                </article>
                <article className="highlight">
                  <span>Depois</span>
                  {afterImage ? <img src={afterImage} alt="Depois" /> : <div>Sem imagem</div>}
                </article>
              </div>
              <button type="button">{text.kiosk_home_cta || "Comecar"}</button>
            </main>
          </div>
        </section>
      )}
    </>
  );
}

function AssetEditor({ label, teamSlug, assets, onChange, type }: {
  label: string;
  teamSlug: string;
  assets: TeamAsset[];
  onChange: (assets: TeamAsset[]) => void;
  type: "shirts" | "backgrounds";
}) {
  const update = (index: number, patch: Partial<TeamAsset>) => {
    const next = [...assets];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const add = () => {
    const id = `${type}-${Date.now()}`;
    onChange([...assets, { id, name: "", subtitle: "", imageUrl: "", assetPath: "", promptDescription: "", visible: true }]);
  };

  return (
      <div className="subpanel">
      <div className="row-between">
        <h3>{label}</h3>
        <button className="secondary" type="button" onClick={add}><Plus size={16} /> Adicionar</button>
      </div>
      <p className="hint">
        {type === "shirts"
          ? "Cadastre as camisas que o cliente vai escolher no totem. Use imagens limpas, de preferencia com fundo claro."
          : "Cadastre os cenarios de fundo que aparecem na foto final."}
      </p>
      <div className="asset-grid">
        {assets.map((asset, index) => (
          <div className="asset-card" key={asset.id}>
            {asset.imageUrl && <img src={publicAssetUrl(asset.imageUrl)} alt={asset.name} />}
            <input placeholder="Nome que aparece no totem" value={asset.name} onChange={(e) => update(index, { name: e.target.value })} />
            <input placeholder="Texto curto abaixo do nome" value={asset.subtitle || ""} onChange={(e) => update(index, { subtitle: e.target.value })} />
            <label className="file-input">
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const extension = file.name.split(".").pop() || "png";
                  const path = uniqueAssetPath(teamSlug || "novo", type, asset.id, extension);
                  const url = await uploadAsset(file, path);
                  update(index, { imageUrl: url, assetPath: url });
                }}
              />
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={asset.visible !== false} onChange={(e) => update(index, { visible: e.target.checked })} />
              Mostrar no totem
            </label>
            <button className="danger" type="button" onClick={() => onChange(assets.filter((_, i) => i !== index))}>Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}

type BuilderScreen = "home" | "shirts" | "backgrounds" | "pix" | "camera" | "generating" | "result";
type BuilderSelection =
  | { type: "text"; key: string; label: string; fallback: string; long?: boolean }
  | { type: "theme" }
  | { type: "logo" }
  | { type: "homeImage"; target: "before" | "after" }
  | { type: "recipe" }
  | { type: "shirt"; index: number }
  | { type: "background"; index: number };

type TeamSetter = <K extends keyof TeamRow>(key: K, value: TeamRow[K]) => void;

const builderScreens: Array<{ id: BuilderScreen; label: string }> = [
  { id: "home", label: "Inicio" },
  { id: "shirts", label: "Camisas" },
  { id: "backgrounds", label: "Cenarios" },
  { id: "pix", label: "PIX" },
  { id: "camera", label: "Camera" },
  { id: "generating", label: "Gerando" },
  { id: "result", label: "Entrega" },
];

const fontOptions = [
  { label: "Padrao limpo", value: "Inter, system-ui, sans-serif" },
  { label: "Flamengo oficial - toolkit", value: flamengoToolkitFontFamily },
  { label: "Esportivo forte", value: "Arial Black, Impact, system-ui, sans-serif" },
  { label: "Classico editorial", value: "Georgia, Times New Roman, serif" },
  { label: "Moderno tecnico", value: "Segoe UI, system-ui, sans-serif" },
  { label: "Impacto de arena", value: "Impact, Arial Black, sans-serif" },
  { label: "Sistema Windows", value: "Segoe UI, Arial, sans-serif" },
];

const builderTextFields: Record<string, Omit<Extract<BuilderSelection, { type: "text" }>, "type">> = {
  kiosk_brand_label: { key: "kiosk_brand_label", label: "Texto pequeno do topo", fallback: "FanFrame Totem" },
  kiosk_total_label: { key: "kiosk_total_label", label: "Texto acima do valor", fallback: "Total" },
  kiosk_home_eyebrow: { key: "kiosk_home_eyebrow", label: "Chamada pequena", fallback: "Experiencia interativa" },
  kiosk_home_title: { key: "kiosk_home_title", label: "Titulo da tela inicial", fallback: "Vista o manto" },
  kiosk_home_subtitle: { key: "kiosk_home_subtitle", label: "Texto de apoio da tela inicial", fallback: "Escolha sua camisa, pague no totem e receba sua foto por QR Code.", long: true },
  kiosk_home_cta: { key: "kiosk_home_cta", label: "Botao da tela inicial", fallback: "Comecar" },
  kiosk_shirt_step: { key: "kiosk_shirt_step", label: "Passo da camisa", fallback: "Passo 1 de 3" },
  kiosk_shirt_title: { key: "kiosk_shirt_title", label: "Titulo da camisa", fallback: "Escolha a camisa" },
  kiosk_background_step: { key: "kiosk_background_step", label: "Passo do cenario", fallback: "Passo 2 de 3" },
  kiosk_background_title: { key: "kiosk_background_title", label: "Titulo do cenario", fallback: "Escolha o cenario" },
  kiosk_continue: { key: "kiosk_continue", label: "Botao continuar", fallback: "Continuar" },
  kiosk_cancel: { key: "kiosk_cancel", label: "Botao cancelar", fallback: "Cancelar" },
  kiosk_payment_step: { key: "kiosk_payment_step", label: "Passo do pagamento", fallback: "Passo 3 de 3" },
  kiosk_payment_title: { key: "kiosk_payment_title", label: "Titulo do pagamento", fallback: "Pagamento PIX" },
  kiosk_payment_pix_hint: { key: "kiosk_payment_pix_hint", label: "Ajuda do PIX", fallback: "Aponte a camera do celular para o QR Code.", long: true },
  kiosk_payment_waiting: { key: "kiosk_payment_waiting", label: "Texto aguardando pagamento", fallback: "Aguardando pagamento" },
  kiosk_payment_pix_cta: { key: "kiosk_payment_pix_cta", label: "Botao PIX", fallback: "Pagar com PIX" },
  kiosk_payment_qr_hint: { key: "kiosk_payment_qr_hint", label: "Ajuda abaixo do QR Code", fallback: "Aponte a camera do celular para pagar com PIX.", long: true },
  kiosk_camera_title: { key: "kiosk_camera_title", label: "Titulo da camera", fallback: "Sua foto" },
  kiosk_camera_capture: { key: "kiosk_camera_capture", label: "Botao capturar", fallback: "Capturar" },
  kiosk_camera_retake: { key: "kiosk_camera_retake", label: "Botao refazer", fallback: "Refazer" },
  kiosk_camera_use: { key: "kiosk_camera_use", label: "Botao usar foto", fallback: "Usar foto" },
  kiosk_generating_title: { key: "kiosk_generating_title", label: "Titulo enquanto gera", fallback: "Gerando imagem" },
  kiosk_generating_subtitle: { key: "kiosk_generating_subtitle", label: "Frase enquanto gera", fallback: "Nao feche nem desligue o totem.", long: true },
  kiosk_result_title: { key: "kiosk_result_title", label: "Titulo da entrega", fallback: "Imagem pronta" },
  kiosk_result_hint: { key: "kiosk_result_hint", label: "Texto do QR final", fallback: "Escaneie para baixar no celular", long: true },
  kiosk_result_finish: { key: "kiosk_result_finish", label: "Botao finalizar", fallback: "Finalizar" },
};

function readBuilderText(texts: Record<string, string>, key: string) {
  const field = builderTextFields[key];
  return texts[key] || field?.fallback || "";
}

function EditablePreviewText({
  fieldKey,
  texts,
  selected,
  variant,
  onSelect,
  onChange,
}: {
  fieldKey: string;
  texts: Record<string, string>;
  selected: boolean;
  variant?: string;
  onSelect: () => void;
  onChange: (key: string, value: string) => void;
}) {
  const field = builderTextFields[fieldKey];
  const value = readBuilderText(texts, fieldKey);
  const className = `preview-editable ${variant || ""} ${selected ? "selected" : ""}`;

  if (selected) {
    const commonProps = {
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(fieldKey, event.target.value),
      onClick: (event: React.MouseEvent) => event.stopPropagation(),
      "aria-label": field?.label || "Texto",
    };
    return field?.long ? (
      <textarea className={`${className} preview-inline-field`} rows={3} autoFocus {...commonProps} />
    ) : (
      <input className={`${className} preview-inline-field`} autoFocus {...commonProps} />
    );
  }

  return (
    <button type="button" className={className} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      {value}
    </button>
  );
}

function InlineKioskPreview({
  team,
  brandLabel,
  teamName,
  totalLabel,
  priceLabel,
  onThemeSelect,
  children,
}: {
  team: Partial<TeamRow>;
  brandLabel: React.ReactNode;
  teamName: React.ReactNode;
  totalLabel: React.ReactNode;
  priceLabel: React.ReactNode;
  onThemeSelect: () => void;
  children: React.ReactNode;
}) {
  const tutorialAssets = (team.tutorial_assets || {}) as TeamTutorialAssets;
  const backgroundImage = publicAssetUrl(typeof tutorialAssets.kioskBackground === "string" ? tutorialAssets.kioskBackground : "");

  return (
    <KioskVisualShell
      className="inline-kiosk-preview"
      shellStyle={{
        backgroundColor: team.primary_color || "#000000",
        color: "#ffffff",
        fontFamily: resolveTeamFontFamily(team),
      }}
      backgroundImage={backgroundImage}
      logoUrl={publicAssetUrl(team.logo_url || "")}
      logoAlt={team.name || ""}
      brandLabel={brandLabel}
      teamName={teamName}
      totalLabel={totalLabel}
      priceLabel={<button type="button" className="preview-price-value" onClick={(event) => { event.stopPropagation(); onThemeSelect(); }}>{priceLabel}</button>}
    >
      {children}
    </KioskVisualShell>
  );
}

function TeamVisualBuilder({
  team,
  textOverrides,
  shirts,
  backgrounds,
  set,
  setTextOverride,
  applyTeamPatch,
}: {
  team: Partial<TeamRow>;
  textOverrides: Record<string, string>;
  shirts: TeamAsset[];
  backgrounds: TeamAsset[];
  set: TeamSetter;
  setTextOverride: (key: string, value: string) => void;
  applyTeamPatch: (patch: Partial<TeamRow>) => void;
}) {
  const [screen, setScreen] = useState<BuilderScreen>("home");
  const [selection, setSelection] = useState<BuilderSelection>({ type: "text", ...builderTextFields.kiosk_home_title });
  const [recipeText, setRecipeText] = useState("");
  const [recipeMessage, setRecipeMessage] = useState("");
  const selectedTextKey = selection.type === "text" ? selection.key : "";
  const visibleShirts = shirts.filter((asset) => asset.visible !== false);
  const visibleBackgrounds = backgrounds.filter((asset) => asset.visible !== false);
  const runtimePreviewUrl = getKioskRuntimePreviewUrl(team.slug || "");
  const tutorialAssets = (team.tutorial_assets || {}) as TeamTutorialAssets;
  const homeBeforeImage = publicAssetUrl(typeof tutorialAssets.before === "string" ? tutorialAssets.before : "");
  const homeAfterImage = publicAssetUrl(typeof tutorialAssets.after === "string" ? tutorialAssets.after : "");

  const selectText = (key: string) => setSelection({ type: "text", ...builderTextFields[key] });
  const openBuilderScreen = (nextScreen: BuilderScreen) => {
    setScreen(nextScreen);
    const defaultTextByScreen: Record<BuilderScreen, string> = {
      home: "kiosk_home_title",
      shirts: "kiosk_shirt_title",
      backgrounds: "kiosk_background_title",
      pix: "kiosk_payment_title",
      camera: "kiosk_camera_title",
      generating: "kiosk_generating_title",
      result: "kiosk_result_title",
    };
    selectText(defaultTextByScreen[nextScreen]);
  };
  const updateAsset = (kind: "shirt" | "background", index: number, patch: Partial<TeamAsset>) => {
    const current = kind === "shirt" ? shirts : backgrounds;
    const next = [...current];
    next[index] = { ...next[index], ...patch };
    set(kind === "shirt" ? "shirts" : "backgrounds", next as TeamRow["shirts"]);
  };
  const addAsset = (kind: "shirt" | "background") => {
    const type = kind === "shirt" ? "shirts" : "backgrounds";
    const current = kind === "shirt" ? shirts : backgrounds;
    const id = `${type}-${Date.now()}`;
    const next = [...current, { id, name: kind === "shirt" ? "Nova camisa" : "Novo cenario", subtitle: "", imageUrl: "", assetPath: "", visible: true }];
    set(type, next as TeamRow["shirts"]);
    setSelection({ type: kind, index: next.length - 1 } as BuilderSelection);
    setScreen(kind === "shirt" ? "shirts" : "backgrounds");
  };
  const removeAsset = (kind: "shirt" | "background", index: number) => {
    const type = kind === "shirt" ? "shirts" : "backgrounds";
    const current = kind === "shirt" ? shirts : backgrounds;
    set(type, current.filter((_, itemIndex) => itemIndex !== index) as TeamRow["shirts"]);
    setSelection({ type: "theme" });
  };
  const moveAsset = (kind: "shirt" | "background", index: number, direction: -1 | 1) => {
    const current = kind === "shirt" ? shirts : backgrounds;
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    set(kind === "shirt" ? "shirts" : "backgrounds", next as TeamRow["shirts"]);
    setSelection({ type: kind, index: target } as BuilderSelection);
  };
  const uploadTeamImage = async (file: File, target: "logo_url" | "watermark_url") => {
    const extension = file.name.split(".").pop() || "png";
    const name = target === "logo_url" ? "logo" : "watermark";
    set(target, await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "branding", name, extension)));
  };
  const uploadTutorialImage = async (file: File, target: "before" | "after") => {
    const extension = file.name.split(".").pop() || "png";
    const url = await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "experience", target, extension));
    set("tutorial_assets", { ...tutorialAssets, [target]: url } as TeamRow["tutorial_assets"]);
  };
  const uploadAssetImage = async (file: File, kind: "shirt" | "background", index: number) => {
    const asset = kind === "shirt" ? shirts[index] : backgrounds[index];
    if (!asset) return;
    const type = kind === "shirt" ? "shirts" : "backgrounds";
    const extension = file.name.split(".").pop() || "png";
    const url = await uploadAsset(file, uniqueAssetPath(team.slug || "novo", type, asset.id, extension));
    updateAsset(kind, index, { imageUrl: url, assetPath: url });
  };
  const copyCurrentRecipe = async () => {
    const recipe = createDesignRecipeFromTeam(team);
    setRecipeText(recipe);
    setRecipeMessage("Receita atual carregada.");
    await navigator.clipboard?.writeText(recipe);
  };
  const applyRecipe = () => {
    const result = applyDesignRecipe(team, recipeText);
    if (result.error) {
      setRecipeMessage(result.error);
      return;
    }
    applyTeamPatch(result.team);
    setRecipeMessage("Receita aplicada no rascunho. Publique para chegar no totem.");
  };
  const renderPreviewScreen = () => {
    if (screen === "home") {
      return (
        <KioskHomeVisual
          eyebrow={<EditablePreviewText fieldKey="kiosk_home_eyebrow" texts={textOverrides} selected={selectedTextKey === "kiosk_home_eyebrow"} variant="eyebrow" onSelect={() => selectText("kiosk_home_eyebrow")} onChange={setTextOverride} />}
          title={<EditablePreviewText fieldKey="kiosk_home_title" texts={textOverrides} selected={selectedTextKey === "kiosk_home_title"} variant="hero-title" onSelect={() => selectText("kiosk_home_title")} onChange={setTextOverride} />}
          subtitle={<EditablePreviewText fieldKey="kiosk_home_subtitle" texts={textOverrides} selected={selectedTextKey === "kiosk_home_subtitle"} variant="subtitle" onSelect={() => selectText("kiosk_home_subtitle")} onChange={setTextOverride} />}
          beforeImage={homeBeforeImage}
          afterImage={homeAfterImage}
          onMediaSelect={(target) => setSelection({ type: "homeImage", target })}
          cta={<EditablePreviewText fieldKey="kiosk_home_cta" texts={textOverrides} selected={selectedTextKey === "kiosk_home_cta"} variant="cta" onSelect={() => selectText("kiosk_home_cta")} onChange={setTextOverride} />}
        />
      );
    }
    if (screen === "shirts") {
      return (
        <KioskSelectionVisual
          kind="shirt"
          stepLabel={<EditablePreviewText fieldKey="kiosk_shirt_step" texts={textOverrides} selected={selectedTextKey === "kiosk_shirt_step"} variant="eyebrow" onSelect={() => selectText("kiosk_shirt_step")} onChange={setTextOverride} />}
          title={<EditablePreviewText fieldKey="kiosk_shirt_title" texts={textOverrides} selected={selectedTextKey === "kiosk_shirt_title"} variant="section-title" onSelect={() => selectText("kiosk_shirt_title")} onChange={setTextOverride} />}
          items={shirts.slice(0, 3).map((asset) => ({
            id: asset.id,
            name: asset.name || "Nome da camisa",
            subtitle: asset.subtitle || "Texto curto",
            imageUrl: publicAssetUrl(asset.imageUrl || ""),
          }))}
          selectedId={selection.type === "shirt" ? shirts[selection.index]?.id : undefined}
          emptyLabel="Adicionar camisa"
          onSelect={(_, index) => setSelection({ type: "shirt", index } as BuilderSelection)}
          cta={
            <div className="builder-preview-actions">
              <EditablePreviewText fieldKey="kiosk_cancel" texts={textOverrides} selected={selectedTextKey === "kiosk_cancel"} variant="ghost-action" onSelect={() => selectText("kiosk_cancel")} onChange={setTextOverride} />
              <EditablePreviewText fieldKey="kiosk_continue" texts={textOverrides} selected={selectedTextKey === "kiosk_continue"} variant="cta compact" onSelect={() => selectText("kiosk_continue")} onChange={setTextOverride} />
            </div>
          }
        />
      );
    }
    if (screen === "backgrounds") {
      return (
        <KioskSelectionVisual
          kind="background"
          stepLabel={<EditablePreviewText fieldKey="kiosk_background_step" texts={textOverrides} selected={selectedTextKey === "kiosk_background_step"} variant="eyebrow" onSelect={() => selectText("kiosk_background_step")} onChange={setTextOverride} />}
          title={<EditablePreviewText fieldKey="kiosk_background_title" texts={textOverrides} selected={selectedTextKey === "kiosk_background_title"} variant="section-title" onSelect={() => selectText("kiosk_background_title")} onChange={setTextOverride} />}
          items={backgrounds.slice(0, 3).map((asset) => ({
            id: asset.id,
            name: asset.name || "Nome do cenario",
            subtitle: asset.subtitle || "Texto curto",
            imageUrl: publicAssetUrl(asset.imageUrl || ""),
          }))}
          selectedId={selection.type === "background" ? backgrounds[selection.index]?.id : undefined}
          emptyLabel="Adicionar cenario"
          onSelect={(_, index) => setSelection({ type: "background", index } as BuilderSelection)}
          cta={
            <div className="builder-preview-actions">
              <EditablePreviewText fieldKey="kiosk_cancel" texts={textOverrides} selected={selectedTextKey === "kiosk_cancel"} variant="ghost-action" onSelect={() => selectText("kiosk_cancel")} onChange={setTextOverride} />
              <EditablePreviewText fieldKey="kiosk_continue" texts={textOverrides} selected={selectedTextKey === "kiosk_continue"} variant="cta compact" onSelect={() => selectText("kiosk_continue")} onChange={setTextOverride} />
            </div>
          }
        />
      );
    }
    if (screen === "pix") {
      return (
        <KioskPaymentVisual
          stepLabel={<EditablePreviewText fieldKey="kiosk_payment_step" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_step"} variant="eyebrow" onSelect={() => selectText("kiosk_payment_step")} onChange={setTextOverride} />}
          title={<EditablePreviewText fieldKey="kiosk_payment_title" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_title"} variant="section-title" onSelect={() => selectText("kiosk_payment_title")} onChange={setTextOverride} />}
          priceLabel={money(Number(team.kiosk_price_cents || 0), team.kiosk_currency || "BRL")}
          pixCta={<EditablePreviewText fieldKey="kiosk_payment_pix_cta" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_pix_cta"} variant="button-copy" onSelect={() => selectText("kiosk_payment_pix_cta")} onChange={setTextOverride} />}
          pixHint={<EditablePreviewText fieldKey="kiosk_payment_pix_hint" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_pix_hint"} variant="inline-muted" onSelect={() => selectText("kiosk_payment_pix_hint")} onChange={setTextOverride} />}
          waitingLabel={<EditablePreviewText fieldKey="kiosk_payment_waiting" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_waiting"} variant="section-title" onSelect={() => selectText("kiosk_payment_waiting")} onChange={setTextOverride} />}
          qrHint={<EditablePreviewText fieldKey="kiosk_payment_qr_hint" texts={textOverrides} selected={selectedTextKey === "kiosk_payment_qr_hint"} variant="subtitle" onSelect={() => selectText("kiosk_payment_qr_hint")} onChange={setTextOverride} />}
          cancelLabel={<EditablePreviewText fieldKey="kiosk_cancel" texts={textOverrides} selected={selectedTextKey === "kiosk_cancel"} variant="ghost-action" onSelect={() => selectText("kiosk_cancel")} onChange={setTextOverride} />}
          status="choose"
        />
      );
    }
    if (screen === "camera") {
      return (
        <KioskCameraVisual
          title={<EditablePreviewText fieldKey="kiosk_camera_title" texts={textOverrides} selected={selectedTextKey === "kiosk_camera_title"} variant="section-title" onSelect={() => selectText("kiosk_camera_title")} onChange={setTextOverride} />}
          hasPhoto={false}
          countdown={team.kiosk_camera_countdown_seconds ?? 5}
          captureLabel={<EditablePreviewText fieldKey="kiosk_camera_capture" texts={textOverrides} selected={selectedTextKey === "kiosk_camera_capture"} variant="button-copy" onSelect={() => selectText("kiosk_camera_capture")} onChange={setTextOverride} />}
          retakeLabel={<EditablePreviewText fieldKey="kiosk_camera_retake" texts={textOverrides} selected={selectedTextKey === "kiosk_camera_retake"} variant="button-copy" onSelect={() => selectText("kiosk_camera_retake")} onChange={setTextOverride} />}
          usePhotoLabel={<EditablePreviewText fieldKey="kiosk_camera_use" texts={textOverrides} selected={selectedTextKey === "kiosk_camera_use"} variant="button-copy" onSelect={() => selectText("kiosk_camera_use")} onChange={setTextOverride} />}
          media={<div className="ff-kiosk-camera-placeholder">Camera</div>}
        />
      );
    }
    if (screen === "generating") {
      const firstWaitingSlide = Array.isArray(tutorialAssets.waitingSlides) ? tutorialAssets.waitingSlides[0] as TeamWaitingSlide | undefined : undefined;
      return (
        <KioskGeneratingVisual
          teamName={team.name || "Nome do time"}
          slideImage={publicAssetUrl(firstWaitingSlide?.imageUrl || "")}
          logoUrl={publicAssetUrl(team.logo_url || "")}
          slideTitle={firstWaitingSlide?.title}
          slideSubtitle={firstWaitingSlide?.subtitle}
          title={<EditablePreviewText fieldKey="kiosk_generating_title" texts={textOverrides} selected={selectedTextKey === "kiosk_generating_title"} variant="button-copy" onSelect={() => selectText("kiosk_generating_title")} onChange={setTextOverride} />}
          subtitle={<EditablePreviewText fieldKey="kiosk_generating_subtitle" texts={textOverrides} selected={selectedTextKey === "kiosk_generating_subtitle"} variant="inline-muted" onSelect={() => selectText("kiosk_generating_subtitle")} onChange={setTextOverride} />}
          progress={65}
          progressLabel="65%"
          hasWaitingVideo={Boolean(tutorialAssets.waitingVideo)}
        />
      );
    }
    return (
      <KioskResultVisual
        title={<EditablePreviewText fieldKey="kiosk_result_title" texts={textOverrides} selected={selectedTextKey === "kiosk_result_title"} variant="section-title" onSelect={() => selectText("kiosk_result_title")} onChange={setTextOverride} />}
        image={homeAfterImage}
        hint={<EditablePreviewText fieldKey="kiosk_result_hint" texts={textOverrides} selected={selectedTextKey === "kiosk_result_hint"} variant="subtitle" onSelect={() => selectText("kiosk_result_hint")} onChange={setTextOverride} />}
        finishLabel={<EditablePreviewText fieldKey="kiosk_result_finish" texts={textOverrides} selected={selectedTextKey === "kiosk_result_finish"} variant="button-copy" onSelect={() => selectText("kiosk_result_finish")} onChange={setTextOverride} />}
      />
    );
  };
  const selectedAsset = selection.type === "shirt" ? shirts[selection.index] : selection.type === "background" ? backgrounds[selection.index] : null;
  const selectedAssetKind = selection.type === "shirt" || selection.type === "background" ? selection.type : null;

  return (
    <div className="visual-builder">
      <aside className="builder-tools">
        <div className="builder-tools-title">
          <MousePointer2 size={18} />
          <div>
            <strong>Editar no preview</strong>
            <span>Clique em textos, imagens e cards.</span>
          </div>
        </div>
        <div className="builder-screen-list">
          {builderScreens.map((item) => (
            <button type="button" key={item.id} className={screen === item.id ? "active" : ""} onClick={() => openBuilderScreen(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="builder-tool-button" onClick={() => setSelection({ type: "theme" })}><Palette size={16} /> Cores e preco</button>
        <button type="button" className="builder-tool-button" onClick={() => setSelection({ type: "logo" })}><ImageIcon size={16} /> Logo do time</button>
        <button type="button" className="builder-tool-button" onClick={() => { setSelection({ type: "recipe" }); if (!recipeText) setRecipeText(createDesignRecipeFromTeam(team)); }}><Code2 size={16} /> Receita JSON</button>
        <button type="button" className="builder-tool-button" onClick={() => addAsset("shirt")}><Plus size={16} /> Nova camisa</button>
        <button type="button" className="builder-tool-button" onClick={() => addAsset("background")}><Plus size={16} /> Novo cenario</button>
        <div className="builder-mini-list">
          <strong>Visiveis no totem</strong>
          <span>{visibleShirts.length} camisa(s) e {visibleBackgrounds.length} cenario(s)</span>
        </div>
      </aside>

      <section className="builder-stage" aria-label="Preview real do totem">
        <div className="runtime-preview-frame">
          <div className="runtime-preview-toolbar">
            <div>
              <strong>Preview real do app</strong>
              <span>Edite clicando nos textos e cards. Publique as mudancas para enviar ao app do totem.</span>
            </div>
            {runtimePreviewUrl && <a className="secondary link-button" href={runtimePreviewUrl} target="_blank" rel="noopener noreferrer">Abrir grande</a>}
          </div>
          <InlineKioskPreview
            team={team}
            brandLabel={<EditablePreviewText fieldKey="kiosk_brand_label" texts={textOverrides} selected={selectedTextKey === "kiosk_brand_label"} variant="micro" onSelect={() => selectText("kiosk_brand_label")} onChange={setTextOverride} />}
            teamName={
              <button type="button" className={`preview-team-name ${selection.type === "logo" ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); setSelection({ type: "logo" }); }}>
                {team.name || "Nome do time"}
              </button>
            }
            totalLabel={<EditablePreviewText fieldKey="kiosk_total_label" texts={textOverrides} selected={selectedTextKey === "kiosk_total_label"} variant="micro" onSelect={() => selectText("kiosk_total_label")} onChange={setTextOverride} />}
            priceLabel={money(Number(team.kiosk_price_cents || 0), team.kiosk_currency || "BRL")}
            onThemeSelect={() => setSelection({ type: "theme" })}
            onLogoSelect={() => setSelection({ type: "logo" })}
          >
            {renderPreviewScreen()}
          </InlineKioskPreview>
        </div>
      </section>

      <aside className="builder-inspector">
        {selection.type === "text" && (
          <>
            <div className="inspector-heading"><Type size={17} /><strong>{selection.label}</strong></div>
            <label>
              Texto
              {selection.long ? (
                <textarea rows={5} value={readBuilderText(textOverrides, selection.key)} onChange={(event) => setTextOverride(selection.key, event.target.value)} />
              ) : (
                <input value={readBuilderText(textOverrides, selection.key)} onChange={(event) => setTextOverride(selection.key, event.target.value)} />
              )}
            </label>
            <p className="hint">Tambem da para editar esse texto direto no preview.</p>
          </>
        )}
        {selection.type === "theme" && (
          <>
            <div className="inspector-heading"><Palette size={17} /><strong>Cores e venda</strong></div>
            <div className="two-fields">
              <label>Fundo<input type="color" value={team.primary_color || "#050505"} onChange={(event) => set("primary_color", event.target.value)} /></label>
              <label>Texto<input type="color" value={team.secondary_color || "#ffffff"} onChange={(event) => set("secondary_color", event.target.value)} /></label>
            </div>
            <label>Fonte do time
              <select
                value={resolveTeamFontFamily(team)}
                onChange={(event) => set("kiosk_font_family", event.target.value)}
                disabled={isFlamengoTeam(team)}
              >
                {fontOptions.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
              </select>
            </label>
            {isFlamengoTeam(team) && <p className="hint">Obrigatorio para Flamengo: fonte oficial secundaria do toolkit, Zalando Sans Expanded.</p>}
            <label>Preco da foto (R$)<input type="number" min="0" step="0.01" value={centsToReais(team.kiosk_price_cents)} onChange={(event) => set("kiosk_price_cents", reaisToCents(event.target.value))} /></label>
            <label>Contagem da foto (s)<input type="number" min="0" max="10" value={team.kiosk_camera_countdown_seconds ?? 5} onChange={(event) => set("kiosk_camera_countdown_seconds", Number(event.target.value))} /></label>
            <label className="inline-check"><input type="checkbox" checked={team.kiosk_enabled !== false} onChange={(event) => set("kiosk_enabled", event.target.checked)} /> Permitir vendas desse time</label>
          </>
        )}
        {selection.type === "logo" && (
          <>
            <div className="inspector-heading"><ImageIcon size={17} /><strong>Logo e marca</strong></div>
            {team.logo_url && <img className="inspector-image-preview" src={publicAssetUrl(team.logo_url)} alt="" />}
            <label className="file-input">Trocar logo<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadTeamImage(file, "logo_url"); }} /></label>
            <label className="file-input">Marca d'agua da foto<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadTeamImage(file, "watermark_url"); }} /></label>
          </>
        )}
        {selection.type === "homeImage" && (
          <>
            <div className="inspector-heading"><ImageIcon size={17} /><strong>{selection.target === "before" ? "Foto do antes" : "Foto do depois"}</strong></div>
            {(selection.target === "before" ? homeBeforeImage : homeAfterImage) && (
              <img className="inspector-image-preview" src={selection.target === "before" ? homeBeforeImage : homeAfterImage} alt="" />
            )}
            <label className="file-input">
              {selection.target === "before" ? "Trocar foto do antes" : "Trocar foto do depois"}
              <input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadTutorialImage(file, selection.target); }} />
            </label>
            <p className="hint">Essa imagem aparece na tela inicial para mostrar ao cliente o exemplo da experiencia.</p>
          </>
        )}
        {selection.type === "recipe" && (
          <>
            <div className="inspector-heading"><Code2 size={17} /><strong>Receita JSON</strong></div>
            <p className="hint">Cole aqui uma receita criada por mim ou copie a receita atual para reaproveitar em outro time. O painel aplica apenas campos seguros.</p>
            <textarea
              className="recipe-textarea"
              rows={18}
              value={recipeText}
              onChange={(event) => setRecipeText(event.target.value)}
              spellCheck={false}
            />
            {recipeMessage && <p className="hint">{recipeMessage}</p>}
            <div className="inspector-actions">
              <button type="button" className="secondary" onClick={copyCurrentRecipe}><Copy size={14} /> Copiar atual</button>
              <button type="button" className="primary" onClick={applyRecipe}>Aplicar receita</button>
            </div>
          </>
        )}
        {selectedAsset && selectedAssetKind && (
          <>
            <div className="inspector-heading"><Shirt size={17} /><strong>{selectedAssetKind === "shirt" ? "Camisa" : "Cenario"}</strong></div>
            {selectedAsset.imageUrl && <img className="inspector-image-preview" src={publicAssetUrl(selectedAsset.imageUrl)} alt="" />}
            <label>Nome<input value={selectedAsset.name || ""} onChange={(event) => updateAsset(selectedAssetKind, selection.index, { name: event.target.value })} /></label>
            <label>Texto curto<input value={selectedAsset.subtitle || ""} onChange={(event) => updateAsset(selectedAssetKind, selection.index, { subtitle: event.target.value })} /></label>
            <label className="file-input">Trocar imagem<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadAssetImage(file, selectedAssetKind, selection.index); }} /></label>
            <label className="inline-check"><input type="checkbox" checked={selectedAsset.visible !== false} onChange={(event) => updateAsset(selectedAssetKind, selection.index, { visible: event.target.checked })} /> Mostrar no totem</label>
            <div className="inspector-actions">
              <button type="button" className="secondary" onClick={() => moveAsset(selectedAssetKind, selection.index, -1)}>Mover esquerda</button>
              <button type="button" className="secondary" onClick={() => moveAsset(selectedAssetKind, selection.index, 1)}>Mover direita</button>
            </div>
            <button type="button" className="danger" onClick={() => removeAsset(selectedAssetKind, selection.index)}>Remover</button>
          </>
        )}
      </aside>
    </div>
  );
}

function TeamForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isNew = slug === "novo";
  const [team, setTeam] = useState<Partial<TeamRow>>(emptyTeam);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [activeTab, setActiveTab] = useState<TeamEditorTab>("construtor");

  useEffect(() => {
    if (isNew || !slug) return;
    supabase.from("teams").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      if (data) {
        const row = { ...emptyTeam, ...(data as TeamRow), text_overrides: ((data as TeamRow).text_overrides || {}) };
        setTeam(mergeKioskDraft(row, row.draft_config));
      }
    });
  }, [slug, isNew]);

  const set = <K extends keyof TeamRow>(key: K, value: TeamRow[K]) => setTeam((current) => ({ ...current, [key]: value }));
  const textOverrides = (team.text_overrides || {}) as Record<string, string>;
  const shirts = (team.shirts || []) as TeamAsset[];
  const backgrounds = (team.backgrounds || []) as TeamAsset[];
  const tutorialAssets = (team.tutorial_assets || {}) as TeamTutorialAssets;
  const waitingSlides = Array.isArray(tutorialAssets.waitingSlides) ? tutorialAssets.waitingSlides : [];
  const pendingDraft = hasUnpublishedDraft(team);
  const missingItems = [
    !team.name && "nome do time",
    !team.kiosk_price_cents && "preco da foto",
    shirts.length === 0 && "camisas",
    backgrounds.length === 0 && "cenarios",
    !team.generation_prompt && "estilo da IA",
  ].filter(Boolean) as string[];
  const setTextOverride = (key: string, value: string) => {
    const next = { ...textOverrides };
    const cleanValue = value.trimStart();
    if (cleanValue.trim()) next[key] = cleanValue;
    else delete next[key];
    set("text_overrides", next);
  };
  const setTutorialAssets = (patch: Partial<TeamTutorialAssets>) => {
    set("tutorial_assets", { ...tutorialAssets, ...patch });
  };
  const uploadExperienceImage = async (file: File, key: "before" | "after" | "kioskBackground" | "waitingVideo" | "deliveryLogo") => {
    try {
      setUploadError("");
      validateExperienceFile(file, key === "waitingVideo" ? "video" : "image");
      const extension = file.name.split(".").pop() || (key === "waitingVideo" ? "mp4" : "png");
      const url = await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "experience", key, extension));
      setTutorialAssets({ [key]: url });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Nao foi possivel enviar o arquivo.");
    }
  };
  const addWaitingSlide = () => {
    setTutorialAssets({
      waitingSlides: [
        ...waitingSlides,
        {
          id: `slide-${Date.now()}`,
          title: "Nova mensagem",
          subtitle: "",
          imageUrl: "",
        },
      ],
    });
  };
  const updateWaitingSlide = (index: number, patch: Partial<TeamWaitingSlide>) => {
    const next = [...waitingSlides];
    next[index] = { ...next[index], ...patch };
    setTutorialAssets({ waitingSlides: next });
  };
  const removeWaitingSlide = (index: number) => {
    setTutorialAssets({ waitingSlides: waitingSlides.filter((_, itemIndex) => itemIndex !== index) });
  };
  const uploadWaitingSlideImage = async (file: File, index: number) => {
    const slide = waitingSlides[index];
    if (!slide) return;
    try {
      setUploadError("");
      validateExperienceFile(file, "image");
      const extension = file.name.split(".").pop() || "png";
      const url = await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "experience", `waiting-${slide.id}`, extension));
      updateWaitingSlide(index, { imageUrl: url });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Nao foi possivel enviar o arquivo.");
    }
  };

  async function saveTeam(publish: boolean) {
    setBusy(true);
    setMessage("");
    const finalSlug = team.slug || slugify(team.name || `time-${Date.now()}`);
    const normalizedTeam = {
      ...team,
      kiosk_font_family: isFlamengoTeam({ ...team, slug: finalSlug }) ? flamengoToolkitFontFamily : team.kiosk_font_family,
      kiosk_price_cents: Number(team.kiosk_price_cents || 0),
      kiosk_timeout_seconds: Math.min(180, Math.max(15, Number(team.kiosk_timeout_seconds || 60))),
      kiosk_camera_countdown_seconds: Math.min(10, Math.max(0, Number(team.kiosk_camera_countdown_seconds ?? 5))),
    };
    const draftConfig = buildKioskDraft(normalizedTeam);
    const basePayload = {
      name: team.name || "Novo time",
      slug: finalSlug,
      subdomain: team.subdomain || finalSlug,
      is_active: team.is_active !== false,
      tutorial_assets: normalizedTeam.tutorial_assets || emptyTeam.tutorial_assets,
      draft_config: draftConfig,
    };
    const payload = {
      ...emptyTeam,
      ...normalizedTeam,
      slug: finalSlug,
      subdomain: team.subdomain || finalSlug,
      draft_config: draftConfig,
      published_config: publish ? draftConfig : team.published_config || {},
      published_config_version: publish ? Number(team.published_config_version || 1) + (isNew ? 0 : 1) : Number(team.published_config_version || 1),
      published_at: publish ? new Date().toISOString() : team.published_at || null,
    };

    const result = isNew || publish
      ? (isNew
        ? await supabase.from("teams").insert(payload).select("slug").single()
        : await supabase.from("teams").update(payload).eq("id", team.id))
      : await supabase.from("teams").update(basePayload).eq("id", team.id);

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (publish && !isNew && team.id) {
      const { data: devices } = await supabase
        .from("kiosk_devices")
        .select("id, config_version")
        .eq("team_id", team.id);

      await Promise.all((devices || []).map(async (device) => {
        await supabase
          .from("kiosk_devices")
          .update({ config_version: Number(device.config_version || 0) + 1 })
          .eq("id", device.id);
        await enqueueDeviceCommand(device.id, "sync_config", {
          reason: "team_updated",
          teamId: team.id,
          teamSlug: finalSlug,
          publishedConfigVersion: payload.published_config_version,
        });
      }));
    }
    if (isNew && result.data?.slug) navigate(`/times/${result.data.slug}`, { replace: true });
    setTeam((current) => ({
      ...current,
      ...basePayload,
      ...(publish ? {
        ...payload,
        published_config: draftConfig,
        published_config_version: payload.published_config_version,
        published_at: payload.published_at,
      } : {}),
    }));
    setMessage(publish ? "Publicado. Os totens vao ver a atualizacao quando sincronizarem." : "Rascunho salvo. Nada mudou nos totens ainda.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await saveTeam(false);
  }

  return (
    <>
      <PageHeader title={isNew ? "Novo time" : "Editar time"} subtitle="Configure o que aparece no totem desse time." />
      <form className="team-editor-shell" onSubmit={save}>
        <section className="team-editor-main panel">
          <div className="editor-tabs" role="tablist" aria-label="Configuracao do time">
            {teamEditorTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "basico" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Informacoes principais</h2>
                <p>Comece pelo nome e pela identidade basica do time.</p>
              </div>
              <label>Nome do time<input value={team.name || ""} onChange={(e) => { set("name", e.target.value); if (isNew) set("slug", slugify(e.target.value)); }} required /></label>
              <label className="inline-check"><input type="checkbox" checked={team.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} /> Time ativo no painel</label>
            </div>
          )}

          {activeTab === "venda" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Venda no totem</h2>
                <p>Defina se esse time vende e quanto o cliente paga pela foto.</p>
              </div>
              <label className="inline-check"><input type="checkbox" checked={team.kiosk_enabled !== false} onChange={(e) => set("kiosk_enabled", e.target.checked)} /> Permitir venda desse time no totem</label>
              <div className="two-fields">
                <label>Preco da foto (R$)<input type="number" min="0" step="0.01" value={centsToReais(team.kiosk_price_cents)} onChange={(e) => set("kiosk_price_cents", reaisToCents(e.target.value))} /></label>
                <label>Tempo parado ate reiniciar<input type="number" min="15" max="180" value={team.kiosk_timeout_seconds || 60} onChange={(e) => set("kiosk_timeout_seconds", Number(e.target.value))} /></label>
                <label>Contagem antes da foto<input type="number" min="0" max="10" value={team.kiosk_camera_countdown_seconds ?? 5} onChange={(e) => set("kiosk_camera_countdown_seconds", Number(e.target.value))} /></label>
              </div>
              <p className="hint">Os tempos sao em segundos. Use 0 na contagem da foto para capturar imediatamente.</p>
            </div>
          )}

          {activeTab === "construtor" && (
            <div className="editor-section builder-editor-section">
              <div className="editor-section-heading">
                <h2>Construtor visual</h2>
                <p>Edite o app clicando direto na previa. As mudancas so chegam no totem quando voce salvar.</p>
              </div>
              <TeamVisualBuilder
                team={team}
                textOverrides={textOverrides}
                shirts={shirts}
                backgrounds={backgrounds}
                set={set}
                setTextOverride={setTextOverride}
                applyTeamPatch={(patch) => setTeam((current) => ({ ...current, ...patch }))}
              />
            </div>
          )}

          {activeTab === "experiencia" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Experiencia do cliente</h2>
                <p>Configure as imagens que explicam o antes/depois e o conteudo que aparece enquanto a IA gera a foto.</p>
              </div>
              <div className="asset-guidance">
                <p>Video recomendado: MP4 vertical {assetLimits.videoRecommendedRatio}, ate {assetLimits.videoRecommendedSeconds} segundos, ate {assetLimits.videoMaxMb} MB, sem audio importante.</p>
                <p>Imagens recomendadas: JPG/PNG vertical, ate {assetLimits.imageMaxMb} MB.</p>
              </div>
              {uploadError && <div className="form-error">{uploadError}</div>}
              <section className="experience-grid">
                <div className="experience-card">
                  <strong>Antes</strong>
                  <span>Foto normal, antes da transformacao.</span>
                  {tutorialAssets.before ? <img src={publicAssetUrl(String(tutorialAssets.before))} alt="" /> : <div className="experience-placeholder">Sem imagem</div>}
                  <label className="file-input">Trocar imagem<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadExperienceImage(file, "before"); }} /></label>
                </div>
                <div className="experience-card">
                  <strong>Depois</strong>
                  <span>Exemplo do resultado com camisa/cenario.</span>
                  {tutorialAssets.after ? <img src={publicAssetUrl(String(tutorialAssets.after))} alt="" /> : <div className="experience-placeholder">Sem imagem</div>}
                  <label className="file-input">Trocar imagem<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadExperienceImage(file, "after"); }} /></label>
                </div>
                <div className="experience-card">
                  <strong>Fundo do app</strong>
                  <span>Imagem sutil no fundo das telas do totem.</span>
                  {tutorialAssets.kioskBackground ? <img src={publicAssetUrl(String(tutorialAssets.kioskBackground))} alt="" /> : <div className="experience-placeholder">Sem imagem</div>}
                  <label className="file-input">Trocar imagem<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadExperienceImage(file, "kioskBackground"); }} /></label>
                </div>
                <div className="experience-card">
                  <strong>Video da espera</strong>
                  <span>Video sem som para distrair o cliente enquanto a IA trabalha.</span>
                  {tutorialAssets.waitingVideo ? (
                    <video src={publicAssetUrl(String(tutorialAssets.waitingVideo))} muted playsInline controls />
                  ) : (
                    <div className="experience-placeholder">Sem video</div>
                  )}
                  <label className="file-input">Enviar video<input type="file" accept="video/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadExperienceImage(file, "waitingVideo"); }} /></label>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Pagina de download</h2>
                  <p>Personalize o que o cliente ve quando abre o QR no celular.</p>
                </div>
              </div>
              <div className="experience-grid">
                <div className="experience-card">
                  <strong>Logo da pagina de download</strong>
                  <span>Use o logo do time ou uma marca especial para a entrega da foto.</span>
                  {tutorialAssets.deliveryLogo ? <img src={publicAssetUrl(String(tutorialAssets.deliveryLogo))} alt="" /> : <div className="experience-placeholder">Sem logo</div>}
                  <label className="file-input">Trocar logo<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadExperienceImage(file, "deliveryLogo"); }} /></label>
                </div>
                <label className="wide-field">Mensagem da pagina de download<textarea rows={4} value={String(tutorialAssets.deliveryMessage || "")} onChange={(event) => setTutorialAssets({ deliveryMessage: event.target.value })} placeholder="Ex: Obrigado por participar. Salve sua foto e marque o time nas redes." /></label>
                <div className="two-fields wide-field">
                  <label>WhatsApp de suporte<input value={String(tutorialAssets.deliveryWhatsApp || "")} onChange={(event) => setTutorialAssets({ deliveryWhatsApp: event.target.value })} placeholder="Ex: 5511999999999" /></label>
                  <label>Instagram<input value={String(tutorialAssets.deliveryInstagram || "")} onChange={(event) => setTutorialAssets({ deliveryInstagram: event.target.value })} placeholder="Ex: @fanframe.ai" /></label>
                </div>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Durante a espera</h2>
                  <p>Esses slides aparecem enquanto a imagem esta sendo gerada. Use frases, curiosidades e imagens do time.</p>
                </div>
                <button type="button" className="secondary" onClick={addWaitingSlide}><Plus size={16} /> Adicionar slide</button>
              </div>
              <div className="waiting-slide-list">
                {waitingSlides.map((slide, index) => (
                  <article className="waiting-slide-card" key={slide.id}>
                    <div className="waiting-slide-preview">
                      {slide.imageUrl ? <img src={publicAssetUrl(slide.imageUrl)} alt="" /> : <ImageIcon size={28} />}
                    </div>
                    <label>Titulo<input value={slide.title || ""} onChange={(event) => updateWaitingSlide(index, { title: event.target.value })} placeholder="Ex: O manto esta quase pronto" /></label>
                    <label>Frase curta<textarea rows={3} value={slide.subtitle || ""} onChange={(event) => updateWaitingSlide(index, { subtitle: event.target.value })} placeholder="Ex: Enquanto isso, conheca uma curiosidade do time." /></label>
                    <label className="file-input">Imagem do slide<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await uploadWaitingSlideImage(file, index); }} /></label>
                    <button type="button" className="danger" onClick={() => removeWaitingSlide(index)}>Remover slide</button>
                  </article>
                ))}
                {waitingSlides.length === 0 && (
                  <div className="empty-state">Nenhum slide cadastrado. Se deixar vazio, o app usa o logo, a camisa e o cenario escolhidos.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "visual" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Visual do app</h2>
                <p>Escolha cores e imagens que deixam o totem com a cara do time.</p>
              </div>
              <div className="two-fields">
                <label>Cor principal<input type="color" value={team.primary_color || "#111827"} onChange={(e) => set("primary_color", e.target.value)} /></label>
                <label>Cor de apoio<input type="color" value={team.secondary_color || "#ffffff"} onChange={(e) => set("secondary_color", e.target.value)} /></label>
              </div>
              <div className="two-fields">
                <label>
                  Logo do time
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    set("logo_url", await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "branding", "logo", file.name.split(".").pop() || "png")));
                  }} />
                </label>
                <label>
                  Marca d'agua da foto
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    set("watermark_url", await uploadAsset(file, uniqueAssetPath(team.slug || "novo", "branding", "watermark", file.name.split(".").pop() || "png")));
                  }} />
                </label>
              </div>
            </div>
          )}

          {activeTab === "textos" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Textos do app</h2>
                <p>Troque as frases que o cliente ve no totem. Campo vazio usa o texto padrao.</p>
              </div>
              <div className="text-override-sections">
                {kioskTextGroups.map((group) => (
                  <div className="text-override-group" key={group.title}>
                    <div>
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                    </div>
                    <div className="text-override-grid">
                      {group.fields.map((field) => (
                        <label className={field.long ? "wide-field" : ""} key={field.key}>
                          {field.label}
                          {field.long ? (
                            <textarea
                              rows={3}
                              value={textOverrides[field.key] || ""}
                              onChange={(event) => setTextOverride(field.key, event.target.value)}
                              placeholder={field.placeholder}
                            />
                          ) : (
                            <input
                              value={textOverrides[field.key] || ""}
                              onChange={(event) => setTextOverride(field.key, event.target.value)}
                              placeholder={field.placeholder}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "camisas" && (
            <div className="editor-section">
              <AssetEditor label="Camisas" teamSlug={team.slug || ""} type="shirts" assets={shirts} onChange={(assets) => set("shirts", assets)} />
            </div>
          )}

          {activeTab === "cenarios" && (
            <div className="editor-section">
              <AssetEditor label="Cenarios" teamSlug={team.slug || ""} type="backgrounds" assets={backgrounds} onChange={(assets) => set("backgrounds", assets)} />
            </div>
          )}

          {activeTab === "ia" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Foto com IA</h2>
                <p>Explique como a foto final deve parecer. Escreva como se estivesse orientando um fotografo.</p>
              </div>
              <label>Estilo da foto<textarea rows={7} value={team.generation_prompt || ""} onChange={(e) => set("generation_prompt", e.target.value)} placeholder="Ex: foto realista de torcedor no estadio, mantendo rosto, postura natural, iluminacao profissional e camisa do time bem visivel." /></label>
            </div>
          )}

          {activeTab === "avancado" && (
            <div className="editor-section">
              <div className="editor-section-heading">
                <h2>Avancado</h2>
                <p>Use apenas quando precisar mudar comportamento tecnico do app.</p>
              </div>
              <label>Codigo interno do time<input value={team.slug || ""} onChange={(e) => set("slug", slugify(e.target.value))} disabled={!isNew} required /></label>
              <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_shirt_step !== false} onChange={(e) => set("kiosk_show_shirt_step", e.target.checked)} /> Mostrar escolha de camisa</label>
              <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_background_step !== false} onChange={(e) => set("kiosk_show_background_step", e.target.checked)} /> Mostrar escolha de cenario</label>
              <p className="hint">Depois de criar o time, o codigo interno fica travado para evitar erro nos totens ja instalados.</p>
            </div>
          )}
        </section>

        <div className="team-editor-status full">
          {missingItems.length > 0 ? (
            <div className="setup-warning">
              <strong>Falta revisar</strong>
              <span>{missingItems.join(", ")}</span>
            </div>
          ) : pendingDraft ? (
            <div className="setup-warning">
              <strong>Rascunho nao publicado</strong>
              <span>Salve e publique para mandar essa versao aos totens.</span>
            </div>
          ) : (
            <div className="setup-ok">
              <strong>Pronto para totem</strong>
              <span>Publicado {team.published_at ? `em ${dateTime(team.published_at)}` : "e pronto para uso"}.</span>
            </div>
          )}
        </div>

        {message && <div className="form-message full">{message}</div>}
        <div className="form-actions full">
          <Link className="secondary link-button" to="/times">Cancelar</Link>
          <button className="secondary" disabled={busy}><Save size={16} /> {busy ? "Salvando..." : "Salvar rascunho"}</button>
          <button className="primary" type="button" disabled={busy || missingItems.length > 0} onClick={() => saveTeam(true)}>
            <RefreshCw size={16} /> {busy ? "Publicando..." : "Publicar no totem"}
          </button>
        </div>
      </form>
    </>
  );
}

function Devices({ role }: { role: Role | null }) {
  const { teams } = useTeams();
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const emptyDeviceForm = {
    team_id: "",
    device_code: "",
    label: "",
    location: "",
    city: "",
    venue: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    expected_app_version: "0.1.0",
    update_channel: "stable",
    installation_notes: "",
    status: "active",
    device_secret: "",
    support_pin: "",
  };
  const [form, setForm] = useState(emptyDeviceForm);
  const [message, setMessage] = useState("");
  const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string; deviceLabel: string; supportPin: string; ownerMessage: string } | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");
  const canEditDevices = canManageBusiness(role);
  const canOperate = canSupportOperations(role);
  const filteredDevices = devices.filter((device) => {
    const haystack = [
      device.label,
      device.device_code,
      device.city,
      device.venue,
      device.location,
      device.owner_name,
      device.owner_phone,
      device.teams?.name,
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = haystack.includes(deviceSearch.trim().toLowerCase());
    const matchesTeam = !teamFilter || device.team_id === teamFilter;
    const matchesHealth = !healthFilter || deviceHealthLabel(device) === healthFilter || device.status === healthFilter;
    return matchesSearch && matchesTeam && matchesHealth;
  });

  const load = async () => {
    const { data } = await supabase.from("kiosk_devices").select("*, teams(name, slug)").order("created_at", { ascending: false });
    setDevices((data || []) as KioskDevice[]);
  };
  useEffect(() => { load(); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const generatedCode =
      form.device_code ||
      slugify([form.city, form.venue, form.label].filter(Boolean).join("-")) ||
      `totem-${Date.now()}`;
    const payload: Record<string, unknown> = {
      team_id: form.team_id,
      device_code: generatedCode,
      label: form.label || form.venue || generatedCode,
      location: form.location,
      city: form.city,
      venue: form.venue,
      owner_name: form.owner_name,
      owner_email: form.owner_email,
      owner_phone: form.owner_phone,
      expected_app_version: form.expected_app_version,
      update_channel: form.update_channel,
      installation_notes: form.installation_notes,
      status: form.status,
      install_status: "not_paired",
    };
    if (form.device_secret) payload.device_secret_hash = await sha256(form.device_secret);
    if (form.support_pin) payload.support_pin_hash = await sha256(form.support_pin);
    const { error } = await supabase.from("kiosk_devices").upsert(payload, { onConflict: "device_code" });
    if (error) setMessage(error.message);
    else {
      setMessage("Totem salvo.");
      setForm(emptyDeviceForm);
      load();
    }
  }

  async function generateInstall(device: KioskDevice) {
    setMessage("");
    try {
      const supportPin = await rotateDeviceSupportPin(device.id);
      const result = await createInstallCode(device.id, device.label || device.device_code);
      const deviceLabel = device.label || device.device_code;
      setInstallCode({
        ...result,
        deviceLabel,
        supportPin,
        ownerMessage: buildOwnerInstallMessage({
          deviceLabel,
          teamName: device.teams?.name,
          location: buildDeviceLocationLabel(device),
          installerUrl: getDeviceInstallerUrl(device),
          installCode: result.code,
          supportPin,
          expiresAt: result.expiresAt,
        }),
      });
      setMessage(`Codigo gerado para ${device.label || device.device_code}.`);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar codigo.");
    }
  }

  async function copyInstallMessage() {
    if (!installCode) return;
    await navigator.clipboard.writeText(installCode.ownerMessage);
    setMessage("Mensagem de instalacao copiada.");
  }

  async function sendCommand(deviceId: string, command: CommandType) {
    setMessage("");
    try {
      await enqueueDeviceCommand(deviceId, command);
      setMessage(`Acao "${friendly(command)}" enviada.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao enviar comando.");
    }
  }

  async function deleteDevice(device: KioskDevice) {
    setMessage("");
    const expected = device.device_code;
    const confirmation = window.prompt(`Para excluir o totem "${device.label || device.device_code}", digite exatamente: ${expected}`);
    if (confirmation !== expected) {
      if (confirmation !== null) setMessage("Exclusao cancelada: confirmacao diferente do codigo do totem.");
      return;
    }

    await logAdminAudit("kiosk_devices", device.id, "device_deleted", {
      deviceCode: device.device_code,
      label: device.label,
      teamId: device.team_id,
    });
    const { error } = await supabase.from("kiosk_devices").delete().eq("id", device.id);
    if (error) {
      setMessage(`Nao foi possivel excluir o totem: ${error.message}`);
      return;
    }

    setMessage(`Totem "${device.label || device.device_code}" excluido.`);
    if (installCode?.deviceLabel === (device.label || device.device_code)) setInstallCode(null);
    load();
  }

  return (
    <>
      <PageHeader title="Totens" subtitle="Cadastre cada computador do totem e acompanhe se esta funcionando." />
      {canEditDevices && (
        <details className="panel device-create-panel create-device-details">
          <summary>
            <div>
              <h2>Novo totem</h2>
              <p>Abra somente quando for cadastrar um novo computador.</p>
            </div>
            <span>Cadastrar</span>
          </summary>
          <div className="section-heading">
            <div>
              <h2>Dados para instalacao</h2>
              <p>Preencha o basico. Codigo, versao e PIN podem ficar automaticos.</p>
            </div>
            <button className="primary" form="device-form">Salvar totem</button>
          </div>
          <form id="device-form" className="simple-device-form" onSubmit={save}>
            <div className="form-block">
              <div className="form-block-title">1. Onde vai ficar</div>
              <div className="compact-grid">
                <label>Time
                  <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} required>
                    <option value="">Escolha o time</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label>Nome do totem
                  <input placeholder="Ex: Shopping Tatuape - Entrada A" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </label>
                <label>Cidade
                  <input placeholder="Ex: Sao Paulo" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label>Ponto
                  <input placeholder="Ex: Shopping, loja ou estadio" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                </label>
                <label>Local dentro do ponto
                  <input placeholder="Ex: perto da praça de alimentacao" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="form-block">
              <div className="form-block-title">2. Quem cuida no local</div>
              <div className="compact-grid owner-grid">
                <label>Nome do responsavel
                  <input placeholder="Nome do dono ou gerente" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </label>
                <label>WhatsApp
                  <input placeholder="Telefone para suporte" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
                </label>
                <label>Email
                  <input placeholder="Opcional" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
                </label>
              </div>
            </div>

            <details className="advanced-box">
              <summary>Configuracao avancada</summary>
              <div className="compact-grid">
                <label>Codigo interno
                  <input placeholder="Deixe vazio para criar automatico" value={form.device_code} onChange={(e) => setForm({ ...form, device_code: e.target.value })} />
                </label>
                <label>Versao esperada
                  <input value={form.expected_app_version} onChange={(e) => setForm({ ...form, expected_app_version: e.target.value })} />
                </label>
                <label>Canal
                  <select value={form.update_channel} onChange={(e) => setForm({ ...form, update_channel: e.target.value })}>
                    <option value="stable">Producao</option>
                    <option value="beta">Teste</option>
                    <option value="maintenance">Manutencao</option>
                  </select>
                </label>
                <label>Status inicial
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Funcionando</option>
                    <option value="maintenance">Em manutencao</option>
                    <option value="disabled">Desabilitado</option>
                  </select>
                </label>
                <label>Chave local do totem
                  <input placeholder="Opcional" value={form.device_secret} onChange={(e) => setForm({ ...form, device_secret: e.target.value })} />
                </label>
                <label>PIN tecnico do dono
                  <input
                    placeholder="Opcional, 4 a 8 digitos"
                    inputMode="numeric"
                    minLength={4}
                    maxLength={8}
                    pattern="[0-9]{4,8}"
                    value={form.support_pin}
                    onChange={(e) => setForm({ ...form, support_pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                  />
                </label>
              </div>
            </details>

            <label>Observacoes
              <textarea placeholder="Algo importante para instalacao ou suporte" value={form.installation_notes} onChange={(e) => setForm({ ...form, installation_notes: e.target.value })} rows={2} />
            </label>
          </form>
          <p className="hint">Depois de salvar, clique em "Instalar" na lista para copiar a mensagem que voce envia ao dono do totem.</p>
          {message && <p className="hint">{message}</p>}
          {installCode && (
            <div className="install-card">
              <div>
                <strong>Codigo de instalacao: {installCode.code}</strong>
                <span>{installCode.deviceLabel} - PIN tecnico: {installCode.supportPin} - expira em {dateTime(installCode.expiresAt)}</span>
              </div>
              <button className="secondary" type="button" onClick={copyInstallMessage}><Copy size={16} /> Copiar para o dono</button>
              <textarea readOnly value={installCode.ownerMessage} rows={8} />
            </div>
          )}
        </details>
      )}
      {!canEditDevices && message && <div className="panel"><p className="hint">{message}</p></div>}
      <section className="panel">
        <div className="section-heading table-heading">
          <div>
            <h2>Totens cadastrados</h2>
            <p>Resumo rapido para saber se precisa agir.</p>
          </div>
        </div>
        <div className="list-toolbar embedded">
          <label>
            Buscar totem
            <input value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} placeholder="Nome, cidade, local ou responsavel" />
          </label>
          <label>
            Time
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="">Todos os times</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label>
            Situacao
            <select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)}>
              <option value="">Todas</option>
              <option value="online">Online</option>
              <option value="offline">Sem contato</option>
              <option value="attention">Com alerta</option>
              <option value="maintenance">Em manutencao</option>
              <option value="disabled">Desativado</option>
            </select>
          </label>
          <div className="toolbar-count">
            <strong>{filteredDevices.length}</strong>
            <span>{filteredDevices.length === 1 ? "totem encontrado" : "totens encontrados"}</span>
          </div>
        </div>
        <div className="device-card-grid">
          {filteredDevices.map((d) => (
            <article className="device-card" key={d.id}>
              <div className="device-card-header">
                <div>
                  <h3>{d.label || d.device_code}</h3>
                  <p>{buildDeviceLocationLabel(d)}</p>
                </div>
                <Badge value={deviceHealthLabel(d)} />
              </div>
              <div className="device-card-meta">
                <div><span>Time</span><strong>{d.teams?.name || "-"}</strong></div>
                <div><span>Instalacao</span><strong>{friendly(d.install_status || "not_paired")}</strong></div>
                <div><span>Ultimo contato</span><strong>{dateTime(d.last_seen_at)}</strong></div>
                <div><span>Versao</span><strong>{friendly(getDeviceVersionStatus(d))}</strong></div>
              </div>
              <div className="device-card-owner">
                {d.owner_name || d.owner_phone ? `${d.owner_name || "Responsavel"} ${d.owner_phone ? `- ${d.owner_phone}` : ""}` : d.device_code}
              </div>
              <div className="device-card-actions">
                <Link className="primary link-button" to={`/totens/${d.id}`}>Abrir controle</Link>
                {canEditDevices && <button className="secondary" onClick={() => generateInstall(d)}>Instalar</button>}
                {canOperate && d.status === "maintenance" && <button className="secondary" onClick={() => sendCommand(d.id, "exit_maintenance")}>Liberar venda</button>}
                {canOperate && d.status !== "maintenance" && <button className="danger" onClick={() => sendCommand(d.id, "enter_maintenance")}>Pausar</button>}
                {canEditDevices && <button className="danger" onClick={() => deleteDevice(d)}><Trash2 size={14} /> Excluir</button>}
              </div>
            </article>
          ))}
          {filteredDevices.length === 0 && <div className="empty-state">{devices.length === 0 ? "Nenhum totem cadastrado ainda." : "Nenhum totem encontrado com esses filtros."}</div>}
        </div>
      </section>
    </>
  );
}

function DeviceDetail({ role }: { role: Role | null }) {
  const { id } = useParams();
  const { teams } = useTeams();
  const [device, setDevice] = useState<KioskDevice | null>(null);
  const [events, setEvents] = useState<KioskDeviceEvent[]>([]);
  const [commands, setCommands] = useState<KioskDeviceCommand[]>([]);
  const [sessions, setSessions] = useState<KioskSession[]>([]);
  const [payments, setPayments] = useState<KioskPayment[]>([]);
  const [message, setMessage] = useState("");
  const [newTeamId, setNewTeamId] = useState("");
  const [changingTeam, setChangingTeam] = useState(false);
  const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string; supportPin: string; ownerMessage: string } | null>(null);
  const [newTechnicalPin, setNewTechnicalPin] = useState("");
  const [updateSettings, setUpdateSettings] = useState({
    installerUrl: "",
    expectedAppVersion: "",
    updateChannel: "stable" as NonNullable<KioskDevice["update_channel"]>,
  });
  const canEditDevices = canManageBusiness(role);
  const canOperate = canSupportOperations(role);

  const load = useCallback(async () => {
    if (!id) return;
    const [deviceRes, eventsRes, commandsRes, sessionsRes, paymentsRes] = await Promise.all([
      supabase.from("kiosk_devices").select("*, teams(name, slug)").eq("id", id).maybeSingle(),
      supabase.from("kiosk_device_events").select("*").eq("device_id", id).order("created_at", { ascending: false }).limit(80),
      supabase.from("kiosk_device_commands").select("*").eq("device_id", id).order("created_at", { ascending: false }).limit(50),
      supabase
        .from("kiosk_sessions")
        .select("*, teams(name, slug), kiosk_devices(device_code,label,location)")
        .eq("device_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("kiosk_payments").select("*, teams(name, slug)").eq("device_id", id).order("created_at", { ascending: false }).limit(25),
    ]);

    setDevice((deviceRes.data || null) as KioskDevice | null);
    setEvents((eventsRes.data || []) as KioskDeviceEvent[]);
    setCommands((commandsRes.data || []) as KioskDeviceCommand[]);
    setSessions((sessionsRes.data || []) as KioskSession[]);
    setPayments((paymentsRes.data || []) as KioskPayment[]);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (device?.team_id) setNewTeamId(device.team_id);
  }, [device?.team_id]);

  useEffect(() => {
    if (!device) return;
    setUpdateSettings({
      installerUrl: typeof device.config?.updates?.installerUrl === "string"
        ? device.config.updates.installerUrl
        : typeof device.config?.updateInstallerUrl === "string"
          ? device.config.updateInstallerUrl
          : "",
      expectedAppVersion: device.expected_app_version || "",
      updateChannel: device.update_channel || "stable",
    });
  }, [device]);

  async function generateInstall() {
    if (!device) return;
    setMessage("");
    try {
      const supportPin = await rotateDeviceSupportPin(device.id);
      const result = await createInstallCode(device.id, device.label || device.device_code);
      setInstallCode({
        ...result,
        supportPin,
        ownerMessage: buildOwnerInstallMessage({
          deviceLabel: device.label || device.device_code,
          teamName: device.teams?.name,
          location: buildDeviceLocationLabel(device),
          installerUrl: updateSettings.installerUrl || getDeviceInstallerUrl(device),
          installCode: result.code,
          supportPin,
          expiresAt: result.expiresAt,
        }),
      });
      setMessage("Codigo de instalacao gerado.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar codigo.");
    }
  }

  async function copyInstallMessage() {
    if (!installCode) return;
    await navigator.clipboard.writeText(installCode.ownerMessage);
    setMessage("Mensagem de instalacao copiada.");
  }

  async function generateTechnicalPin() {
    if (!device) return;
    setMessage("");
    try {
      const supportPin = await rotateDeviceSupportPin(device.id);
      setNewTechnicalPin(supportPin);
      await enqueueDeviceCommand(device.id, "sync_config", { reason: "support_pin_rotated" });
      setMessage("Novo PIN tecnico gerado. Use este PIN no app do totem.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar PIN tecnico.");
    }
  }

  async function copyTechnicalPin() {
    if (!newTechnicalPin) return;
    await navigator.clipboard.writeText(newTechnicalPin);
    setMessage("PIN tecnico copiado.");
  }

  async function copyUpdateMessage() {
    if (!device) return;
    await navigator.clipboard.writeText(buildOwnerUpdateMessage({
      deviceLabel: device.label || device.device_code,
      teamName: device.teams?.name,
      location: buildDeviceLocationLabel(device),
      currentVersion: device.app_version,
      expectedVersion: device.expected_app_version,
    }));
    setMessage("Mensagem de atualizacao copiada.");
  }

  async function sendCommand(command: CommandType) {
    if (!device) return;
    setMessage("");
    try {
      await enqueueDeviceCommand(device.id, command);
      setMessage(`Acao "${friendly(command)}" enviada.`);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao enviar comando.");
    }
  }

  async function changeDeviceTeam() {
    if (!device || !newTeamId || newTeamId === device.team_id) return;
    const nextTeam = teams.find((team) => team.id === newTeamId);
    setChangingTeam(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("kiosk_devices")
        .update({
          team_id: newTeamId,
          config_version: (device.config_version || 0) + 1,
          status: "active",
          maintenance_reason: null,
        })
        .eq("id", device.id);
      if (error) throw error;

      await logAdminAudit("kiosk_devices", device.id, "team_changed", {
        previousTeamId: device.team_id,
        nextTeamId: newTeamId,
        nextTeamName: nextTeam?.name || null,
      });
      await enqueueDeviceCommand(device.id, "sync_config", {
        reason: "team_changed",
        teamId: newTeamId,
        teamName: nextTeam?.name || null,
        teamSlug: nextTeam?.slug || null,
      });
      setMessage(`Time trocado para ${nextTeam?.name || "novo time"}. O totem vai atualizar quando estiver online.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao trocar time do totem.");
    } finally {
      setChangingTeam(false);
    }
  }

  async function saveDeviceUpdateSettings(event: FormEvent) {
    event.preventDefault();
    if (!device) return;
    setMessage("");
    const nextConfig = { ...(device.config || {}) };
    const updateInstallerUrl = updateSettings.installerUrl.trim();
    const nextUpdates = {
      ...(nextConfig.updates && typeof nextConfig.updates === "object" && !Array.isArray(nextConfig.updates) ? nextConfig.updates : {}),
    };
    if (updateInstallerUrl) {
      nextConfig.updateInstallerUrl = updateInstallerUrl;
      nextUpdates.installerUrl = updateInstallerUrl;
      nextConfig.updates = nextUpdates;
    } else {
      delete nextConfig.updateInstallerUrl;
      delete nextUpdates.installerUrl;
      if (Object.keys(nextUpdates).length > 0) nextConfig.updates = nextUpdates;
      else delete nextConfig.updates;
    }

    try {
      const { error } = await supabase
        .from("kiosk_devices")
        .update({
          expected_app_version: updateSettings.expectedAppVersion.trim() || null,
          update_channel: updateSettings.updateChannel,
          config: nextConfig,
          config_version: (device.config_version || 0) + 1,
        })
        .eq("id", device.id);
      if (error) throw error;

      await enqueueDeviceCommand(device.id, "sync_config", { reason: "update_settings_changed" });
      setMessage("Configuracao de atualizacao salva. O totem vai sincronizar quando estiver online.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar atualizacao do totem.");
    }
  }

  if (!device) {
    return (
      <>
        <PageHeader title="Totem" subtitle="Carregando dispositivo..." action={<Link className="secondary link-button" to="/totens">Voltar</Link>} />
        <div className="panel empty-state">Totem nao encontrado ou sem permissao.</div>
      </>
    );
  }

  const health = device.last_health_status || {};
  const paymentStatus = health.paymentStatus && typeof health.paymentStatus === "object"
    ? health.paymentStatus as Record<string, unknown>
    : null;
  const deviceIssues = getOperationalIssues(device);
  const pendingCommandCount = commands.filter((c) => c.status === "pending" || c.status === "running").length;

  return (
    <>
      <PageHeader
        title={device.label || device.device_code}
        subtitle={`${device.teams?.name || "Sem time"} - ${device.location || "Sem localizacao"}`}
        action={<Link className="secondary link-button" to="/totens">Voltar</Link>}
      />

      <section className={`device-hero-panel ${deviceHealthLabel(device)}`}>
        <div>
          <span>Status do totem</span>
          <h2>{friendly(deviceHealthLabel(device))}</h2>
          <p>{deviceIssues[0]?.message || "Nenhum problema importante detectado agora."}</p>
        </div>
        <div className="device-hero-facts">
          <div><span>Instalacao</span><strong>{friendly(device.install_status || "not_paired")}</strong></div>
          <div><span>Ultimo contato</span><strong>{dateTime(device.last_seen_at)}</strong></div>
          <div><span>Versao</span><strong>{device.app_version || "-"} / {device.expected_app_version || "-"}</strong></div>
          <div><span>Acoes em fila</span><strong>{pendingCommandCount}</strong></div>
        </div>
      </section>

      <section className="panel device-actions">
        <div>
          <h2>Controle remoto do totem</h2>
          <p className="hint">Use essas acoes sem acessar o Windows do local. O totem recebe o comando quando estiver online.</p>
        </div>
        <div className="actions-row">
          {canOperate && <button className="secondary" onClick={() => sendCommand("sync_config")}>Atualizar dados</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("exit_maintenance")}>Liberar vendas</button>}
          {canOperate && <button className="danger" onClick={() => sendCommand("enter_maintenance")}>Pausar vendas</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("restart_app")}>Reiniciar app</button>}
          {canEditDevices && <button className="secondary" onClick={generateInstall}>Gerar codigo de instalacao</button>}
          {!canOperate && !canEditDevices && <span className="hint">Seu perfil permite somente visualizacao.</span>}
        </div>
        <details className="remote-secondary-actions">
          <summary>Mais acoes de suporte</summary>
          <div className="actions-row">
            {canEditDevices && <button className="secondary" onClick={generateTechnicalPin}>Gerar novo PIN tecnico</button>}
            {getDeviceVersionStatus(device) === "desatualizado" && <button className="secondary" onClick={copyUpdateMessage}><Copy size={16} /> Copiar mensagem de atualizacao</button>}
            {canOperate && <button className="secondary" onClick={() => sendCommand("send_diagnostics")}>Pedir diagnostico</button>}
          </div>
        </details>
        {canEditDevices && (
          <div className="remote-team-switch">
            <div>
              <strong>Trocar time deste totem</strong>
              <span>Escolha outro time e o app instalado vai sincronizar automaticamente quando estiver online.</span>
            </div>
            <select value={newTeamId} onChange={(event) => setNewTeamId(event.target.value)}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button className="primary" disabled={!newTeamId || newTeamId === device.team_id || changingTeam} onClick={changeDeviceTeam}>
              {changingTeam ? "Trocando..." : "Trocar time"}
            </button>
          </div>
        )}
        {message && <p className="hint">{message}</p>}
        {newTechnicalPin && (
          <div className="install-card">
            <div>
              <strong>Novo PIN tecnico: {newTechnicalPin}</strong>
              <span>Este PIN aparece so agora. Copie e envie para quem esta no totem.</span>
            </div>
            <button className="secondary" type="button" onClick={copyTechnicalPin}><Copy size={16} /> Copiar PIN</button>
          </div>
        )}
        {installCode && (
          <div className="install-card">
            <div>
              <strong>Codigo de instalacao: {installCode.code}</strong>
              <span>PIN tecnico: {installCode.supportPin} - expira em {dateTime(installCode.expiresAt)}</span>
            </div>
            <button className="secondary" type="button" onClick={copyInstallMessage}><Copy size={16} /> Copiar para o dono</button>
            <textarea readOnly value={installCode.ownerMessage} rows={8} />
          </div>
        )}
      </section>

      {canEditDevices && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Atualizacao do app</h2>
              <p className="hint">Configure a versao que este totem deve usar e o link HTTPS do instalador.</p>
            </div>
          </div>
          <form className="compact-grid" onSubmit={saveDeviceUpdateSettings}>
            <label>Link do instalador
              <input
                placeholder="https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe"
                value={updateSettings.installerUrl}
                onChange={(event) => setUpdateSettings({ ...updateSettings, installerUrl: event.target.value })}
              />
            </label>
            <label>Versao desejada
              <input
                placeholder="0.2.1"
                value={updateSettings.expectedAppVersion}
                onChange={(event) => setUpdateSettings({ ...updateSettings, expectedAppVersion: event.target.value })}
              />
            </label>
            <label>Canal de atualizacao
              <select
                value={updateSettings.updateChannel}
                onChange={(event) => setUpdateSettings({ ...updateSettings, updateChannel: event.target.value as NonNullable<KioskDevice["update_channel"]> })}
              >
                <option value="stable">Producao</option>
                <option value="beta">Teste</option>
                <option value="maintenance">Manutencao</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary">Salvar atualizacao</button>
            </div>
          </form>
        </section>
      )}

      <section className="two-col">
        <div className="panel settings-list">
          <h2>Dono e local</h2>
          <div><strong>Codigo interno</strong><span>{device.device_code}</span></div>
          <div><strong>Cidade</strong><span>{device.city || "-"}</span></div>
          <div><strong>Ponto</strong><span>{device.venue || "-"}</span></div>
          <div><strong>Local</strong><span>{device.location || "-"}</span></div>
          <div><strong>Responsavel</strong><span>{device.owner_name || "-"}</span></div>
          <div><strong>Email</strong><span>{device.owner_email || "-"}</span></div>
          <div><strong>WhatsApp</strong><span>{device.owner_phone || "-"}</span></div>
          <div><strong>PIN do suporte local</strong><span>{device.support_pin_hash ? "Configurado" : "Nao definido"}</span></div>
          <div><strong>Link do instalador</strong><span>{device.config?.updateInstallerUrl || "-"}</span></div>
          <div><strong>Canal de atualizacao</strong><span>{friendly(device.update_channel || "stable")}</span></div>
          <div><strong>Versao desejada</strong><span>{device.expected_app_version || "-"}</span></div>
          <div><strong>Observacoes</strong><span>{device.installation_notes || "-"}</span></div>
        </div>
        <details className="panel settings-list advanced-box">
          <summary>Ultima comunicacao do app</summary>
          <div><strong>Online</strong><span>{String(health.online ?? "-")}</span></div>
          <div><strong>Tela</strong><span>{String(health.currentScreen ?? "-")}</span></div>
          <div><strong>Versao informada</strong><span>{String(health.appVersion ?? "-")}</span></div>
          <div><strong>Pagamento</strong><span>{paymentStatus ? String(paymentStatus.ready ? "Pronto" : "Indisponivel") : "-"}</span></div>
          <div><strong>Tipo de pagamento</strong><span>{paymentStatus ? friendly(String(paymentStatus.mode || "-")) : "-"}</span></div>
          <div><strong>Detalhe</strong><span>{paymentStatus ? String(paymentStatus.message || "-") : "-"}</span></div>
          <div><strong>Ultimo check-in</strong><span>{dateTime(device.last_health_at)}</span></div>
          <div><strong>Manutencao</strong><span>{device.maintenance_reason || "-"}</span></div>
        </details>
      </section>

      <details className="panel advanced-box">
        <summary>Historico tecnico e acoes enviadas</summary>
        <section className="two-col advanced-content">
        <div className="panel">
          <h2>Historico tecnico</h2>
          <DataTable columns={["Tipo", "Urgencia", "Codigo", "Mensagem", "Criado"]}>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.event_type}</td>
                <td><Badge value={event.severity} /></td>
                <td>{event.error_code || "-"}</td>
                <td>{event.message || "-"}</td>
                <td>{dateTime(event.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="panel">
          <h2>Acoes enviadas</h2>
          <DataTable columns={["Acao", "Situacao", "Erro", "Criado", "Finalizado"]}>
            {commands.map((command) => (
              <tr key={command.id}>
                <td>{friendly(command.command_type)}</td>
                <td><Badge value={command.status} /></td>
                <td>{command.error_message || "-"}</td>
                <td>{dateTime(command.created_at)}</td>
                <td>{dateTime(command.completed_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </section>
      </details>

      <section className="two-col">
        <div className="panel">
          <h2>Ultimas vendas</h2>
          <DataTable columns={["Situacao", "Escolha", "Valor", "Erro", "Criada"]}>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td><Badge value={session.status} /></td>
                <td>{session.selected_shirt_id || "-"} / {session.selected_background_id || "-"}</td>
                <td>{money(session.amount_cents, session.currency)}</td>
                <td>{session.error_message || "-"}</td>
                <td>{dateTime(session.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="panel">
          <h2>Ultimos pagamentos</h2>
          <DataTable columns={["Forma", "Operadora", "Situacao", "Valor", "Pago em"]}>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{friendly(payment.method)}</td>
                <td>{friendly(payment.provider)}</td>
                <td><Badge value={payment.status} /></td>
                <td>{money(payment.amount_cents, payment.currency)}</td>
                <td>{dateTime(payment.paid_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </section>
    </>
  );
}

function FilterBar({ filters, setFilters, teams }: { filters: Filters; setFilters: (filters: Filters) => void; teams: TeamRow[] }) {
  return (
    <div className="filters">
      <select value={filters.teamId} onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}>
        <option value="">Todos os times</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
        <option value="">Todas as situacoes</option>
        <option value="pending">Pendente</option>
        <option value="paid">Pago</option>
        <option value="completed">Concluido</option>
        <option value="failed">Com erro</option>
        <option value="cancelled">Cancelado</option>
      </select>
      <select value={filters.days} onChange={(e) => setFilters({ ...filters, days: Number(e.target.value) })}>
        <option value="1">Hoje</option>
        <option value="7">7 dias</option>
        <option value="30">30 dias</option>
        <option value="90">90 dias</option>
      </select>
    </div>
  );
}

function Sessions() {
  const { teams } = useTeams();
  const [filters, setFilters] = useState<Filters>({ teamId: "", status: "", days: 7 });
  const [rows, setRows] = useState<KioskSession[]>([]);
  const [payments, setPayments] = useState<KioskPayment[]>([]);
  const [generations, setGenerations] = useState<GenerationQueueRow[]>([]);
  const [consentLogs, setConsentLogs] = useState<ConsentLogRow[]>([]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - filters.days * 86400000).toISOString();
    let sessionQuery = supabase
      .from("kiosk_sessions")
      .select("*, teams(name, slug), kiosk_devices(device_code,label,location)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    let paymentQuery = supabase
      .from("kiosk_payments")
      .select("*, teams(name, slug)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    let generationQuery = supabase
      .from("generation_queue")
      .select("*, teams(name, slug)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    let consentQuery = supabase
      .from("consent_logs")
      .select("*, teams(name, slug)")
      .eq("consent_type", "kiosk_social_share")
      .gte("accepted_at", since)
      .order("accepted_at", { ascending: false })
      .limit(120);

    if (filters.teamId) {
      sessionQuery = sessionQuery.eq("team_id", filters.teamId);
      paymentQuery = paymentQuery.eq("team_id", filters.teamId);
      generationQuery = generationQuery.eq("team_id", filters.teamId);
      consentQuery = consentQuery.eq("team_id", filters.teamId);
    }
    if (filters.status) {
      sessionQuery = sessionQuery.eq("status", filters.status);
      paymentQuery = paymentQuery.eq("status", filters.status);
      generationQuery = generationQuery.eq("status", filters.status);
    }

    const [sessionRes, paymentRes, generationRes, consentRes] = await Promise.all([sessionQuery, paymentQuery, generationQuery, consentQuery]);
    setRows((sessionRes.data || []) as KioskSession[]);
    setPayments((paymentRes.data || []) as KioskPayment[]);
    setGenerations((generationRes.data || []) as GenerationQueueRow[]);
    setConsentLogs((consentRes.data || []) as ConsentLogRow[]);
  }, [filters.days, filters.status, filters.teamId]);
  useEffect(() => { load(); }, [load]);

  const paid = payments.filter((payment) => payment.status === "paid");
  const revenue = paid.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const pendingPayments = payments.filter((payment) => payment.status === "pending").length;
  const failedGenerations = generations.filter((row) => row.status === "failed").length;

  return (
    <>
      <PageHeader title="Vendas" subtitle="Atendimentos, pagamentos e fotos em uma tela so." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <section className="stats-grid compact-stats">
        <StatCard label="Atendimentos" value={rows.length} />
        <StatCard label="Pagas" value={paid.length} tone="success" />
        <StatCard label="Pendente" value={pendingPayments} tone={pendingPayments ? "warning" : "neutral"} />
        <StatCard label="Receita" value={money(revenue)} tone="success" />
        <StatCard label="Falhas IA" value={failedGenerations} tone={failedGenerations ? "danger" : "neutral"} />
      </section>
      <FilterBar filters={filters} setFilters={setFilters} teams={teams} />
      <div className="panel">
        <div className="section-heading table-heading">
          <div>
            <h2>Atendimentos</h2>
            <p>O caminho completo do cliente: escolha, pagamento, foto e entrega.</p>
          </div>
        </div>
        <div className="sales-card-list">
          {rows.map((row) => {
            const payment = payments.find((item) => item.session_id === row.id);
            const generation = generations.find((item) => item.id === row.generation_queue_id);
            return (
              <article className="sales-card" key={row.id}>
                <div className="sales-main">
                  <div>
                    <h3>{row.teams?.name || "Time nao informado"}</h3>
                    <p>{row.kiosk_devices?.label || row.kiosk_devices?.device_code || "Totem nao informado"} - {dateTime(row.created_at)}</p>
                  </div>
                  <Badge value={row.status} />
                </div>
                <div className="sales-steps">
                  <div><span>Pagamento</span><strong>{payment ? friendly(payment.status) : "Nao iniciado"}</strong></div>
                  <div><span>Foto IA</span><strong>{generation ? friendly(generation.status) : "Aguardando"}</strong></div>
                  <div><span>Valor</span><strong>{money(row.amount_cents, row.currency)}</strong></div>
                </div>
                {(row.error_message || generation?.error_message) && (
                  <p className="sales-error">{row.error_message || generation?.error_message}</p>
                )}
                <details>
                  <summary>Ver detalhes</summary>
                  <div className="sales-detail-grid">
                    <div><span>Camisa</span><strong>{row.selected_shirt_id || "-"}</strong></div>
                    <div><span>Cenario</span><strong>{row.selected_background_id || "-"}</strong></div>
                    <div><span>Pago em</span><strong>{dateTime(payment?.paid_at)}</strong></div>
                    <div><span>Foto</span><strong>{generation?.result_image_url ? <a href={generation.result_image_url} target="_blank">Abrir</a> : "-"}</strong></div>
                  </div>
                </details>
              </article>
            );
          })}
          {rows.length === 0 && <div className="empty-state">Nenhum atendimento neste filtro.</div>}
        </div>
      </div>
      <div className="panel">
        <div className="section-heading table-heading">
          <div>
            <h2>Fotos autorizadas para redes</h2>
            <p>Clientes que autorizaram uso da foto pelo link do QR Code. A publicacao continua sendo manual e revisada.</p>
          </div>
        </div>
        <div className="authorized-photo-list">
          {consentLogs.map((log) => {
            const payload = readConsentPayload(log.consent_text);
            const imageUrl = typeof payload.result_image_url === "string" ? payload.result_image_url : "";
            return (
              <article className="authorized-photo-card" key={log.id}>
                {imageUrl ? <img src={imageUrl} alt="" /> : <div className="authorized-photo-placeholder">Sem foto</div>}
                <div>
                  <strong>{log.teams?.name || "Time nao informado"}</strong>
                  <span>Autorizado em {dateTime(log.accepted_at)}</span>
                  <span>{String(payload.session_id || log.user_id)}</span>
                </div>
                {imageUrl && <a className="secondary link-button" href={imageUrl} target="_blank">Abrir foto</a>}
              </article>
            );
          })}
          {consentLogs.length === 0 && <div className="empty-state">Nenhuma foto autorizada neste filtro.</div>}
        </div>
      </div>
      <details className="panel advanced-box">
        <summary>Pagamentos e fotos da IA em formato tecnico</summary>
        <section className="two-col advanced-content">
        <div className="subpanel">
          <h2>Pagamentos</h2>
          <DataTable columns={["Time", "Forma", "Situacao", "Valor", "Pago em"]}>
            {payments.slice(0, 120).map((row) => (
              <tr key={row.id}>
                <td>{row.teams?.name || "-"}</td>
                <td>{friendly(row.method)}</td>
                <td><Badge value={row.status} /></td>
                <td>{money(row.amount_cents, row.currency)}</td>
                <td>{dateTime(row.paid_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="subpanel">
          <h2>Fotos da IA</h2>
          <DataTable columns={["Time", "Situacao", "Camisa", "Erro", "Foto"]}>
            {generations.slice(0, 120).map((row) => (
              <tr key={row.id}>
                <td>{row.teams?.name || "-"}</td>
                <td><Badge value={row.status} /></td>
                <td>{row.shirt_id || "-"}</td>
                <td>{row.error_message || "-"}</td>
                <td>{row.result_image_url ? <a href={row.result_image_url} target="_blank">Abrir</a> : "-"}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </section>
      </details>
    </>
  );
}

function ProblemsPage() {
  const [alerts, setAlerts] = useState<SystemAlertRow[]>([]);
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  useEffect(() => {
    supabase.from("system_alerts").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAlerts((data || []) as SystemAlertRow[]));
    supabase.from("kiosk_devices").select("*, teams(name, slug)").order("last_seen_at", { ascending: false }).then(({ data }) => setDevices((data || []) as KioskDevice[]));
    supabase.from("kiosk_admin_audit_events").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAuditEvents((data || []) as AdminAuditEvent[]));
  }, []);
  const operationalIssues = devices.flatMap((device) => getOperationalIssues(device));
  const issuesBySeverity = {
    danger: operationalIssues.filter((issue) => issue.severity === "danger"),
    warning: operationalIssues.filter((issue) => issue.severity === "warning"),
    ok: operationalIssues.filter((issue) => issue.severity === "ok"),
  };
  const issueGroups = [
    { title: "Resolver agora", issues: issuesBySeverity.danger },
    { title: "Verificar hoje", issues: issuesBySeverity.warning },
    { title: "Informativo", issues: issuesBySeverity.ok },
  ];
  return (
    <>
      <PageHeader title="Problemas" subtitle="Tudo que precisa de atencao, em linguagem simples." />
      <section className="stats-grid">
        <StatCard label="Problemas abertos" value={alerts.filter((a) => !a.resolved).length} tone="warning" />
        <StatCard label="Totens sem contato" value={devices.filter((d) => isOffline(d.last_seen_at)).length} tone="danger" />
        <StatCard label="Em manutencao" value={devices.filter((d) => d.status === "maintenance").length} />
        <StatCard label="Precisam atualizar" value={devices.filter((d) => getDeviceVersionStatus(d) === "desatualizado").length} tone="warning" />
      </section>
      {issueGroups.map((group) => (
        <div className="panel" key={group.title}>
          <h2>{group.title}</h2>
          <div className="issue-card-list">
            {group.issues.map((issue) => (
              <article className="issue-card" key={`${issue.deviceId}-${issue.type}`}>
                <div>
                  <Badge value={issue.severity} />
                  <h3>{friendly(issue.type)}</h3>
                  <p>{issue.message}</p>
                  <span>{issue.deviceLabel}</span>
                </div>
                <Link className="primary link-button" to={`/totens/${issue.deviceId}`}>Resolver</Link>
              </article>
            ))}
            {group.issues.length === 0 && (
              <div className="empty-state">Nenhum item nesta prioridade.</div>
            )}
          </div>
        </div>
      ))}
      <details className="panel advanced-box">
        <summary>Alertas do sistema</summary>
        <DataTable columns={["Tipo", "Urgencia", "Mensagem", "Resolvido", "Criado"]}>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td>{friendly(alert.type)}</td>
              <td><Badge value={alert.severity} /></td>
              <td>{alert.message}</td>
              <td>{alert.resolved ? "Sim" : "Nao"}</td>
              <td>{dateTime(alert.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      </details>
      <details className="panel advanced-box">
        <summary>Historico tecnico de acoes</summary>
        <DataTable columns={["Acao", "Area", "Alvo", "Usuario", "Detalhe", "Criado"]}>
          {auditEvents.map((event) => (
            <tr key={event.id}>
              <td>{friendly(event.action)}</td>
              <td>{friendly(event.target_table)}</td>
              <td>{event.target_id || "-"}</td>
              <td>{event.actor_user_id || "-"}</td>
              <td>{JSON.stringify(event.payload || {})}</td>
              <td>{dateTime(event.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      </details>
    </>
  );
}

function UsersPage({ role }: { role: Role | null }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("admin");
  const [message, setMessage] = useState("");
  const canManage = canManageUsers(role);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "list" } });
    if (error || data?.error) setMessage(data?.error || error?.message || "Erro ao carregar usuarios.");
    else setUsers(data.users || []);
  };
  useEffect(() => { if (canManage) load(); }, [canManage]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const { data, error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "create", email, password, role: newRole } });
    if (error || data?.error) setMessage(data?.error || error?.message);
    else {
      setEmail("");
      setPassword("");
      setMessage("Usuario criado.");
      load();
    }
  }

  async function remove(userId: string) {
    if (!confirm("Remover este usuario administrador?")) return;
    setMessage("");
    const { data, error } = await supabase.functions.invoke("manage-admin-users", { body: { action: "delete", user_id: userId } });
    if (error || data?.error) setMessage(data?.error || error?.message);
    else {
      setMessage("Usuario removido.");
      load();
    }
  }

  if (!canManage) {
    return (
      <>
        <PageHeader title="Usuarios" subtitle="Somente super admins podem gerenciar operadores." />
        <div className="panel empty-state"><Shield size={28} /> Seu usuario nao pode criar ou remover acessos.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Crie acessos para quem vai ajudar na operacao." />
      <section className="two-col">
        <div className="panel">
          <h2>Novo acesso</h2>
          <p className="hint">Use perfis simples. Operador geral resolve quase tudo; financeiro so acompanha vendas.</p>
          <form className="stacked-form" onSubmit={create}>
            <label>Email<input type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Senha inicial<input type="password" placeholder="senha inicial" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <label>Perfil
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="admin">Operador geral</option>
                <option value="support">Suporte dos totens</option>
                <option value="finance">Financeiro</option>
                <option value="super_admin">Dono do sistema</option>
              </select>
            </label>
            <button className="primary">Criar acesso</button>
          </form>
          {message && <p className="hint">{message}</p>}
        </div>
        <div className="panel role-help">
          <h2>Quem pode fazer o que</h2>
          <div><strong>Dono do sistema</strong><span>Acessa tudo, inclusive usuarios.</span></div>
          <div><strong>Operador geral</strong><span>Configura times, totens e acompanha vendas.</span></div>
          <div><strong>Suporte</strong><span>Cuida dos totens e problemas, sem mexer em usuarios.</span></div>
          <div><strong>Financeiro</strong><span>Ve vendas e pagamentos.</span></div>
        </div>
      </section>
      <section className="panel">
        <h2>Acessos ativos</h2>
        <div className="user-card-list">
          {users.map((user) => (
            <article className="user-card" key={user.id}>
              <div>
                <strong>{user.email}</strong>
                <span>Criado em {dateTime(user.created_at)}</span>
              </div>
              <Badge value={user.role} />
              <button className="danger" onClick={() => remove(user.id)}>Remover</button>
            </article>
          ))}
          {users.length === 0 && <div className="empty-state">Nenhum usuario cadastrado.</div>}
        </div>
      </section>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Informacoes simples sobre publicacao e integracoes." />
      <section className="settings-card-grid">
        <div className="settings-card">
          <strong>Painel admin</strong>
          <span>Publicado na Vercel como app separado para operacao remota.</span>
        </div>
        <div className="settings-card">
          <strong>Totem Windows</strong>
          <span>App dedicado em Electron. O dono do ponto usa apenas instalacao e modo tecnico.</span>
        </div>
        <div className="settings-card">
          <strong>Pagamento</strong>
          <span>Fluxo normal usa somente PIX PagBank em producao. Teste sem pagamento fica no app local.</span>
        </div>
        <div className="settings-card">
          <strong>Segredos</strong>
          <span>Replicate, PagBank e chaves sensiveis ficam no Supabase, fora da tela do operador.</span>
        </div>
      </section>
    </>
  );
}

type DeliveryPayload = {
  imageUrl?: string;
  expiresAt?: string;
  team?: {
    name?: string | null;
    logo_url?: string | null;
    tutorial_assets?: TeamTutorialAssets | null;
  } | null;
  error?: string;
};

function normalizeWhatsAppUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const input = value.trim();
  try {
    const url = new URL(input);
    const phone = url.hostname.toLowerCase() === "wa.me"
      ? url.pathname.split("/").filter(Boolean)[0] || ""
      : url.searchParams.get("phone") || "";
    const digits = phone.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  } catch {
    const digits = input.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
}

function DeliveryPage() {
  const { token = "" } = useParams();
  const [payload, setPayload] = useState<DeliveryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadDelivery() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-delivery-link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "get_delivery", token }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar sua foto.");
        if (alive) setPayload(data);
      } catch (deliveryError) {
        if (alive) setError(deliveryError instanceof Error ? deliveryError.message : "Nao foi possivel carregar sua foto.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadDelivery();
    return () => { alive = false; };
  }, [token]);

  const tutorialAssets = payload?.team?.tutorial_assets || {};
  const logoUrl = publicAssetUrl(String(tutorialAssets.deliveryLogo || payload?.team?.logo_url || ""));
  const teamName = payload?.team?.name || "FanFrame";
  const imageUrl = payload?.imageUrl || "";
  const whatsAppUrl = normalizeWhatsAppUrl(tutorialAssets.deliveryWhatsApp);
  const customMessage = typeof tutorialAssets.deliveryMessage === "string" && tutorialAssets.deliveryMessage.trim()
    ? tutorialAssets.deliveryMessage.trim()
    : "Sua foto ficou pronta. Baixe no celular e compartilhe com quem vive essa experiencia com voce.";

  async function sharePhoto() {
    if (!imageUrl) return;
    setMessage("");
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : "jpg";
      const file = new File([blob], `fanframe-foto.${extension}`, { type: blob.type || "image/jpeg" });
      const shareData = {
        title: "Minha foto FanFrame",
        text: "Olha minha foto gerada no totem FanFrame.",
        files: [file],
      };
      if (navigator.canShare?.(shareData) && navigator.share) {
        await navigator.share(shareData).catch(() => undefined);
        return;
      }
    } catch {
      // Some mobile browsers block file sharing from remote images. Fall back below.
    }

    if (navigator.share) {
      await navigator.share({ title: "Minha foto FanFrame", text: "Olha minha foto gerada no totem FanFrame.", url: imageUrl }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(imageUrl).catch(() => undefined);
      setMessage("Link copiado. Se preferir, toque em Baixar foto.");
    }
  }

  async function downloadPhoto() {
    if (!imageUrl) return;
    setMessage("");
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : "jpg";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `fanframe-foto.${extension}`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Download iniciado.");
    } catch {
      setMessage("Nao foi possivel baixar automaticamente. Toque e segure na foto para salvar.");
    }
  }

  async function registerConsent() {
    setMessage("");
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-delivery-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "share_consent", token }),
      });
      if (!response.ok) throw new Error("Nao foi possivel registrar agora.");
      setMessage("Autorizacao registrada. Obrigado!");
    } catch (consentError) {
      setMessage(consentError instanceof Error ? consentError.message : "Nao foi possivel registrar agora.");
    }
  }

  if (loading) {
    return (
      <main className="delivery-page">
        <section className="delivery-shell compact">
          <span className="delivery-kicker">FanFrame</span>
          <h1>Carregando sua foto</h1>
          <p>Aguarde so um instante.</p>
        </section>
      </main>
    );
  }

  if (error || !imageUrl) {
    return (
      <main className="delivery-page">
        <section className="delivery-shell compact">
          <span className="delivery-kicker">FanFrame</span>
          <h1>Link indisponivel</h1>
          <p>{error || "Nao encontramos a foto deste QR Code."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-page">
      <section className="delivery-shell">
        <header className="delivery-header">
          {logoUrl ? <img src={logoUrl} alt={`Logo ${teamName}`} /> : <div className="delivery-logo-fallback">FF</div>}
          <div>
            <span className="delivery-kicker">{teamName}</span>
            <h1>Foto pronta</h1>
          </div>
        </header>

        <p className="delivery-message">{customMessage}</p>

        <figure className="delivery-photo-card">
          <img src={imageUrl} alt="Foto gerada pelo FanFrame" />
        </figure>

        <div className="delivery-actions">
          <button type="button" className="delivery-primary" onClick={downloadPhoto}>Baixar foto</button>
          <button type="button" className="delivery-secondary" onClick={sharePhoto}>Compartilhar</button>
        </div>

        <section className="delivery-consent">
          <strong>Quer aparecer nas redes?</strong>
          <p>Autorize o FanFrame a avaliar esta foto para posts e stories. A publicacao continua sendo revisada manualmente.</p>
          <button type="button" onClick={registerConsent}>Autorizo usar minha foto</button>
        </section>

        {whatsAppUrl && <a className="delivery-support" href={whatsAppUrl} target="_blank" rel="noreferrer">Falar com suporte</a>}
        {payload?.expiresAt && <small>Link valido ate {dateTime(payload.expiresAt)}.</small>}
        {message && <p className="delivery-feedback">{message}</p>}
      </section>
    </main>
  );
}

function App() {
  const auth = useAuth();

  return (
    <Routes>
      <Route path="/foto/:token" element={<DeliveryPage />} />
      <Route path="/login" element={auth.user && auth.role ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <Protected auth={auth}>
          <Layout auth={auth}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/kiosk" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><KioskOnlinePreview /></RoleGate>} />
              <Route path="/times" element={<RoleGate role={auth.role} allowed={["super_admin", "admin"]}><Teams /></RoleGate>} />
              <Route path="/times/:slug" element={<RoleGate role={auth.role} allowed={["super_admin", "admin"]}><TeamForm /></RoleGate>} />
              <Route path="/totens" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><Devices role={auth.role} /></RoleGate>} />
              <Route path="/totens/:id" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><DeviceDetail role={auth.role} /></RoleGate>} />
              <Route path="/sessoes" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support", "finance"]}><Sessions /></RoleGate>} />
              <Route path="/pagamentos" element={<Navigate to="/sessoes" replace />} />
              <Route path="/geracoes" element={<Navigate to="/sessoes" replace />} />
              <Route path="/status" element={<Navigate to="/problemas" replace />} />
              <Route path="/problemas" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><ProblemsPage /></RoleGate>} />
              <Route path="/usuarios" element={<RoleGate role={auth.role} allowed={["super_admin"]}><UsersPage role={auth.role} /></RoleGate>} />
              <Route path="/configuracoes" element={<RoleGate role={auth.role} allowed={["super_admin", "admin"]}><SettingsPage /></RoleGate>} />
            </Routes>
          </Layout>
        </Protected>
      } />
    </Routes>
  );
}

export default App;
