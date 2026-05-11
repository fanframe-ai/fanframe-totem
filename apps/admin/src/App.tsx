import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Copy,
  Cpu,
  CreditCard,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Shirt,
  Users,
} from "lucide-react";
import { supabase, publicAssetUrl } from "./lib/supabase";
import { createInstallCode, enqueueDeviceCommand, rotateDeviceSupportPin, sha256 } from "./lib/deviceOperations";
import { buildOwnerInstallMessage, buildOwnerUpdateMessage } from "./lib/installInstructions";
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
  tutorial_assets: {},
  primary_color: "#111827",
  secondary_color: "#ffffff",
  logo_url: null,
  watermark_url: null,
  is_active: true,
  kiosk_enabled: true,
  kiosk_price_cents: 2500,
  kiosk_currency: "BRL",
  kiosk_timeout_seconds: 60,
  kiosk_default_mode: "standard",
  kiosk_show_shirt_step: true,
  kiosk_show_background_step: true,
};

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
  debit: "Debito",
  disabled: "Desativado",
  error: "Erro",
  failed: "Com erro",
  finance: "Financeiro",
  generating: "Gerando foto",
  habilitado: "Ligado",
  inativo: "Inativo",
  info: "Informacao",
  kiosk: "Totem",
  maintenance: "Em manutencao",
  not_paired: "Nao instalado",
  offline: "Sem contato",
  online: "Online",
  paid: "Pago",
  paired: "Instalado",
  pairing: "Instalacao",
  pagbank_pix: "PIX PagBank",
  pending: "Pendente",
  pix: "PIX",
  plugpag: "Cartao",
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

async function uploadAsset(file: File, path: string) {
  const { error } = await supabase.storage.from("tryon-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return publicAssetUrl(path);
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
    { href: "/pagamentos", Icon: CreditCard, label: "Pagamentos", roles: ["super_admin", "admin", "finance"] as Role[] },
    { href: "/geracoes", Icon: ImageIcon, label: "Fotos geradas", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/status", Icon: AlertTriangle, label: "Alertas", roles: ["super_admin", "admin", "support"] as Role[] },
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

  return (
    <>
      <PageHeader title="Inicio" subtitle="O que precisa de atencao hoje nos seus totens." />
      <section className="stats-grid">
        <StatCard label="Times ativos" value={teams.filter((t) => t.is_active).length} />
        <StatCard label="Totens vendendo" value={devices.filter((d) => d.status === "active").length} />
        <StatCard label="Totens sem contato" value={devices.filter((d) => isOffline(d.last_seen_at)).length} tone="danger" />
        <StatCard label="Com alerta" value={operationalIssues.length} tone={operationalIssues.some((issue) => issue.severity === "critical") ? "danger" : "warning"} />
        <StatCard label="Vendas hoje" value={paidToday.length} tone="success" />
        <StatCard label="Receita hoje" value={money(revenue)} tone="success" />
        <StatCard label="Precisam atualizar" value={devices.filter((d) => getDeviceVersionStatus(d) === "desatualizado").length} tone="warning" />
      </section>
      <section className="panel">
        <h2>Precisa de atencao</h2>
        {operationalIssues.length > 0 ? (
          <DataTable columns={["Urgencia", "Totem", "Problema"]}>
            {operationalIssues.slice(0, 8).map((issue) => (
              <tr key={`${issue.deviceId}-${issue.type}`}>
                <td><Badge value={issue.severity} /></td>
                <td>{issue.deviceLabel}</td>
                <td>{issue.message}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <p className="hint">Nenhum problema importante detectado agora.</p>
        )}
      </section>
      <section className="two-col">
        <div className="panel">
          <h2>Vendas recentes</h2>
          <DataTable columns={["Time", "Totem", "Situacao", "Valor", "Criada"]}>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.teams?.name || "-"}</td>
                <td>{s.kiosk_devices?.label || s.kiosk_devices?.device_code || "-"}</td>
                <td><Badge value={s.status} /></td>
                <td>{money(s.amount_cents, s.currency)}</td>
                <td>{dateTime(s.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
        <div className="panel">
          <h2>Totens recentes</h2>
          <DataTable columns={["Totem", "Time", "Situacao", "Versao", "Ultimo contato"]}>
            {devices.slice(0, 12).map((d) => (
              <tr key={d.id}>
                <td>{d.label || d.device_code}</td>
                <td>{d.teams?.name || "-"}</td>
                <td><Badge value={deviceHealthLabel(d)} /></td>
                <td>{d.app_version || "-"} / {d.expected_app_version || "-"}</td>
                <td>{dateTime(d.last_seen_at)}</td>
              </tr>
            ))}
          </DataTable>
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
  const { teams, loading } = useTeams();
  return (
    <>
      <PageHeader
        title="Times"
        subtitle="Crie times, preco, camisas, cenarios e a instrucao da IA."
        action={<Link className="primary link-button" to="/times/novo"><Plus size={16} /> Novo time</Link>}
      />
      <div className="panel">
        <DataTable columns={["Time", "Link", "Totem", "Preco", "Imagens", "Situacao", ""]}>
          {!loading && teams.map((team) => (
            <tr key={team.id}>
              <td><strong>{team.name}</strong></td>
              <td>/{team.slug}</td>
              <td><Badge value={team.kiosk_enabled ? "habilitado" : "desabilitado"} /></td>
              <td>{money(team.kiosk_price_cents, team.kiosk_currency)}</td>
              <td>{team.shirts?.length || 0} camisas / {team.backgrounds?.length || 0} cenarios</td>
              <td><Badge value={team.is_active ? "ativo" : "inativo"} /></td>
              <td><Link to={`/times/${team.slug}`}>Editar</Link></td>
            </tr>
          ))}
        </DataTable>
      </div>
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
            {type === "shirts" && (
              <textarea placeholder="Como essa camisa deve aparecer na foto" value={asset.promptDescription || ""} onChange={(e) => update(index, { promptDescription: e.target.value })} />
            )}
            <label className="file-input">
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const extension = file.name.split(".").pop() || "png";
                  const path = `${teamSlug || "novo"}/${type}/${asset.id}.${extension}`;
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

function TeamForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isNew = slug === "novo";
  const [team, setTeam] = useState<Partial<TeamRow>>(emptyTeam);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isNew || !slug) return;
    supabase.from("teams").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      if (data) setTeam(data as TeamRow);
    });
  }, [slug, isNew]);

  const set = <K extends keyof TeamRow>(key: K, value: TeamRow[K]) => setTeam((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const finalSlug = team.slug || slugify(team.name || `time-${Date.now()}`);
    const payload = {
      ...emptyTeam,
      ...team,
      slug: finalSlug,
      subdomain: team.subdomain || finalSlug,
      kiosk_price_cents: Number(team.kiosk_price_cents || 0),
      kiosk_timeout_seconds: Math.min(180, Math.max(15, Number(team.kiosk_timeout_seconds || 60))),
    };

    const result = isNew
      ? await supabase.from("teams").insert(payload).select("slug").single()
      : await supabase.from("teams").update(payload).eq("id", team.id);

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (isNew && result.data?.slug) navigate(`/times/${result.data.slug}`, { replace: true });
    setMessage("Time salvo com sucesso.");
  }

  return (
    <>
      <PageHeader title={isNew ? "Novo time" : "Editar time"} subtitle="Configure o que aparece no totem desse time." />
      <form className="form-grid" onSubmit={save}>
        <section className="panel form-section">
          <h2>Dados do time</h2>
          <label>Nome<input value={team.name || ""} onChange={(e) => { set("name", e.target.value); if (isNew) set("slug", slugify(e.target.value)); }} required /></label>
          <label>Link do time<input value={team.slug || ""} onChange={(e) => set("slug", slugify(e.target.value))} disabled={!isNew} required /></label>
          <p className="hint">Esse link identifica o time no sistema e na instalacao do totem.</p>
          <div className="two-fields">
            <label>Cor principal<input type="color" value={team.primary_color || "#111827"} onChange={(e) => set("primary_color", e.target.value)} /></label>
            <label>Cor de apoio<input type="color" value={team.secondary_color || "#ffffff"} onChange={(e) => set("secondary_color", e.target.value)} /></label>
          </div>
          <label className="inline-check"><input type="checkbox" checked={team.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} /> Time ativo</label>
        </section>

        <section className="panel form-section">
          <h2>Venda no totem</h2>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_enabled !== false} onChange={(e) => set("kiosk_enabled", e.target.checked)} /> Este time pode vender no totem</label>
          <label>Preco da foto (R$)<input type="number" min="0" step="0.01" value={centsToReais(team.kiosk_price_cents)} onChange={(e) => set("kiosk_price_cents", reaisToCents(e.target.value))} /></label>
          <label>Tempo limite da tela (segundos)<input type="number" min="15" max="180" value={team.kiosk_timeout_seconds || 60} onChange={(e) => set("kiosk_timeout_seconds", Number(e.target.value))} /></label>
          <p className="hint">Depois desse tempo parado, o totem volta para o comeco automaticamente.</p>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_shirt_step !== false} onChange={(e) => set("kiosk_show_shirt_step", e.target.checked)} /> Mostrar escolha de camisa</label>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_background_step !== false} onChange={(e) => set("kiosk_show_background_step", e.target.checked)} /> Mostrar escolha de cenario</label>
        </section>

        <section className="panel form-section full">
          <h2>Aparencia e IA</h2>
          <label>Instrucao para a IA<textarea rows={4} value={team.generation_prompt || ""} onChange={(e) => set("generation_prompt", e.target.value)} placeholder="Ex: gerar uma foto realista do torcedor vestindo a camisa do time, mantendo rosto e postura naturais." /></label>
          <p className="hint">Aqui voce escreve o estilo da imagem final. Chaves tecnicas de IA e pagamento ficam protegidas fora do painel.</p>
          <div className="two-fields">
            <label>
              Logo
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                set("logo_url", await uploadAsset(file, `${team.slug || "novo"}/branding/logo.${file.name.split(".").pop() || "png"}`));
              }} />
            </label>
            <label>
              Marca d'agua
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                set("watermark_url", await uploadAsset(file, `${team.slug || "novo"}/branding/watermark.${file.name.split(".").pop() || "png"}`));
              }} />
            </label>
          </div>
        </section>

        <section className="panel full">
          <h2>Camisas e cenarios</h2>
          <AssetEditor label="Camisas" teamSlug={team.slug || ""} type="shirts" assets={(team.shirts || []) as TeamAsset[]} onChange={(assets) => set("shirts", assets)} />
          <AssetEditor label="Cenarios" teamSlug={team.slug || ""} type="backgrounds" assets={(team.backgrounds || []) as TeamAsset[]} onChange={(assets) => set("backgrounds", assets)} />
        </section>

        {message && <div className="form-message full">{message}</div>}
        <div className="form-actions full">
          <Link className="secondary link-button" to="/times">Cancelar</Link>
          <button className="primary" disabled={busy}><Save size={16} /> {busy ? "Salvando..." : "Salvar time"}</button>
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
  const canEditDevices = canManageBusiness(role);
  const canOperate = canSupportOperations(role);

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

  return (
    <>
      <PageHeader title="Totens" subtitle="Cadastre cada computador do totem e acompanhe se esta funcionando." />
      {canEditDevices && (
        <section className="panel device-create-panel">
          <div className="section-heading">
            <div>
              <h2>Novo totem</h2>
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
        </section>
      )}
      {!canEditDevices && message && <div className="panel"><p className="hint">{message}</p></div>}
      <section className="panel">
        <div className="section-heading table-heading">
          <div>
            <h2>Totens cadastrados</h2>
            <p>Resumo rapido para saber se precisa agir.</p>
          </div>
        </div>
        <DataTable columns={["Totem", "Time", "Saude", "Instalacao", "Ultimo contato", "Acoes"]}>
          {devices.map((d) => (
            <tr key={d.id}>
              <td className="device-name-cell">
                <strong>{d.label || d.device_code}</strong>
                <span>{buildDeviceLocationLabel(d)}</span>
                <span>{d.owner_name || d.owner_phone ? `${d.owner_name || "Responsavel"} ${d.owner_phone ? `- ${d.owner_phone}` : ""}` : d.device_code}</span>
              </td>
              <td>{d.teams?.name || "-"}</td>
              <td>
                <Badge value={deviceHealthLabel(d)} />
                <br />
                <span>{friendly(getDeviceVersionStatus(d))}</span>
              </td>
              <td><Badge value={d.install_status || "not_paired"} /></td>
              <td>{dateTime(d.last_seen_at)}</td>
              <td className="actions-cell">
                <Link className="secondary link-button" to={`/totens/${d.id}`}>Abrir</Link>
                {canEditDevices && <button className="secondary" onClick={() => generateInstall(d)}>Instalar</button>}
                {canOperate && d.status === "maintenance" && <button className="secondary" onClick={() => sendCommand(d.id, "exit_maintenance")}>Liberar venda</button>}
                {canOperate && d.status !== "maintenance" && <button className="danger" onClick={() => sendCommand(d.id, "enter_maintenance")}>Pausar</button>}
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

function DeviceDetail({ role }: { role: Role | null }) {
  const { id } = useParams();
  const [device, setDevice] = useState<KioskDevice | null>(null);
  const [events, setEvents] = useState<KioskDeviceEvent[]>([]);
  const [commands, setCommands] = useState<KioskDeviceCommand[]>([]);
  const [sessions, setSessions] = useState<KioskSession[]>([]);
  const [payments, setPayments] = useState<KioskPayment[]>([]);
  const [message, setMessage] = useState("");
  const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string; supportPin: string; ownerMessage: string } | null>(null);
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

  return (
    <>
      <PageHeader
        title={device.label || device.device_code}
        subtitle={`${device.teams?.name || "Sem time"} - ${device.location || "Sem localizacao"}`}
        action={<Link className="secondary link-button" to="/totens">Voltar</Link>}
      />

      <section className="stats-grid">
        <StatCard label="Situacao" value={friendly(deviceHealthLabel(device))} tone={deviceHealthLabel(device) === "online" ? "success" : "warning"} />
        <StatCard label="Instalacao" value={friendly(device.install_status || "not_paired")} />
        <StatCard label="Versao do app" value={`${device.app_version || "-"} / ${device.expected_app_version || "-"}`} />
        <StatCard label="Atualizacao" value={friendly(getDeviceVersionStatus(device))} tone={getDeviceVersionStatus(device) === "desatualizado" ? "warning" : "neutral"} />
        <StatCard label="Ultimo contato" value={dateTime(device.last_seen_at)} />
        <StatCard label="Ultimo erro" value={device.last_error_code || "-"} tone={device.last_error_code ? "danger" : "neutral"} />
        <StatCard label="Acoes em fila" value={commands.filter((c) => c.status === "pending" || c.status === "running").length} />
      </section>

      <section className="panel device-actions">
        <div>
          <h2>Controle remoto do totem</h2>
          <p className="hint">Use essas acoes sem acessar o Windows do local. O totem recebe o comando quando estiver online.</p>
        </div>
        <div className="actions-row">
          {canEditDevices && <button className="secondary" onClick={generateInstall}>Gerar codigo para instalar</button>}
          {getDeviceVersionStatus(device) === "desatualizado" && <button className="secondary" onClick={copyUpdateMessage}><Copy size={16} /> Copiar mensagem de atualizacao</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("sync_config")}>Atualizar dados</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("send_diagnostics")}>Pedir diagnostico</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("restart_app")}>Reiniciar app</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("exit_maintenance")}>Liberar vendas</button>}
          {canOperate && <button className="danger" onClick={() => sendCommand("enter_maintenance")}>Pausar vendas</button>}
          {!canOperate && !canEditDevices && <span className="hint">Seu perfil permite somente visualizacao.</span>}
        </div>
        {message && <p className="hint">{message}</p>}
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
          <div><strong>Canal de atualizacao</strong><span>{friendly(device.update_channel || "stable")}</span></div>
          <div><strong>Versao desejada</strong><span>{device.expected_app_version || "-"}</span></div>
          <div><strong>Observacoes</strong><span>{device.installation_notes || "-"}</span></div>
        </div>
        <div className="panel settings-list">
          <h2>Ultima comunicacao do app</h2>
          <div><strong>Online</strong><span>{String(health.online ?? "-")}</span></div>
          <div><strong>Tela</strong><span>{String(health.currentScreen ?? "-")}</span></div>
          <div><strong>Versao informada</strong><span>{String(health.appVersion ?? "-")}</span></div>
          <div><strong>Pagamento</strong><span>{paymentStatus ? String(paymentStatus.ready ? "Pronto" : "Indisponivel") : "-"}</span></div>
          <div><strong>Tipo de pagamento</strong><span>{paymentStatus ? friendly(String(paymentStatus.mode || "-")) : "-"}</span></div>
          <div><strong>Detalhe</strong><span>{paymentStatus ? String(paymentStatus.message || "-") : "-"}</span></div>
          <div><strong>Ultimo check-in</strong><span>{dateTime(device.last_health_at)}</span></div>
          <div><strong>Manutencao</strong><span>{device.maintenance_reason || "-"}</span></div>
        </div>
      </section>

      <section className="two-col">
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

  const load = useCallback(async () => {
    const since = new Date(Date.now() - filters.days * 86400000).toISOString();
    let query = supabase
      .from("kiosk_sessions")
      .select("*, teams(name, slug), kiosk_devices(device_code,label,location)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    if (filters.teamId) query = query.eq("team_id", filters.teamId);
    if (filters.status) query = query.eq("status", filters.status);
    const { data } = await query;
    setRows((data || []) as KioskSession[]);
  }, [filters.days, filters.status, filters.teamId]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Vendas" subtitle="Veja cada atendimento do totem, do pagamento ate o QR Code." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <FilterBar filters={filters} setFilters={setFilters} teams={teams} />
      <div className="panel">
        <DataTable columns={["Time", "Totem", "Situacao", "Escolha", "Valor", "Erro", "Criada"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.teams?.name || "-"}</td>
              <td>{row.kiosk_devices?.label || row.kiosk_devices?.device_code || "-"}</td>
              <td><Badge value={row.status} /></td>
              <td>{row.selected_shirt_id || "-"} / {row.selected_background_id || "-"}</td>
              <td>{money(row.amount_cents, row.currency)}</td>
              <td>{row.error_message || "-"}</td>
              <td>{dateTime(row.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  );
}

function Payments() {
  const { teams } = useTeams();
  const [filters, setFilters] = useState<Filters>({ teamId: "", status: "", days: 7 });
  const [rows, setRows] = useState<KioskPayment[]>([]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - filters.days * 86400000).toISOString();
    let query = supabase.from("kiosk_payments").select("*, teams(name, slug)").gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    if (filters.teamId) query = query.eq("team_id", filters.teamId);
    if (filters.status) query = query.eq("status", filters.status);
    const { data } = await query;
    setRows((data || []) as KioskPayment[]);
  }, [filters.days, filters.status, filters.teamId]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Confira cobrancas pagas, pendentes ou com erro." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <FilterBar filters={filters} setFilters={setFilters} teams={teams} />
      <div className="panel">
        <DataTable columns={["Time", "Forma", "Operadora", "Situacao", "Valor", "Codigo", "Pago em"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.teams?.name || "-"}</td>
              <td>{friendly(row.method)}</td>
              <td>{friendly(row.provider)}</td>
              <td><Badge value={row.status} /></td>
              <td>{money(row.amount_cents, row.currency)}</td>
              <td>{row.reference_id}</td>
              <td>{dateTime(row.paid_at)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  );
}

function Generations() {
  const [rows, setRows] = useState<GenerationQueueRow[]>([]);
  const load = async () => {
    const { data } = await supabase.from("generation_queue").select("*, teams(name, slug)").order("created_at", { ascending: false }).limit(300);
    setRows((data || []) as GenerationQueueRow[]);
  };
  useEffect(() => { load(); }, []);
  return (
    <>
      <PageHeader title="Fotos geradas" subtitle="Acompanhe as fotos criadas pela IA e possiveis erros." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <div className="panel">
        <DataTable columns={["Time", "De onde veio", "Situacao", "Camisa", "Erro", "Criada", "Foto"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.teams?.name || "-"}</td>
              <td>{friendly(row.source || "web")}</td>
              <td><Badge value={row.status} /></td>
              <td>{row.shirt_id}</td>
              <td>{row.error_message || "-"}</td>
              <td>{dateTime(row.created_at)}</td>
              <td>{row.result_image_url ? <a href={row.result_image_url} target="_blank">Abrir</a> : "-"}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  );
}

function StatusPage() {
  const [alerts, setAlerts] = useState<SystemAlertRow[]>([]);
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  useEffect(() => {
    supabase.from("system_alerts").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAlerts((data || []) as SystemAlertRow[]));
    supabase.from("kiosk_devices").select("*, teams(name, slug)").order("last_seen_at", { ascending: false }).then(({ data }) => setDevices((data || []) as KioskDevice[]));
    supabase.from("kiosk_admin_audit_events").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAuditEvents((data || []) as AdminAuditEvent[]));
  }, []);
  const operationalIssues = devices.flatMap((device) => getOperationalIssues(device));
  return (
    <>
      <PageHeader title="Alertas" subtitle="Veja o que precisa de atencao nos totens." />
      <section className="stats-grid">
        <StatCard label="Alertas abertos" value={alerts.filter((a) => !a.resolved).length} tone="warning" />
        <StatCard label="Totens sem contato" value={devices.filter((d) => isOffline(d.last_seen_at)).length} tone="danger" />
        <StatCard label="Em manutencao" value={devices.filter((d) => d.status === "maintenance").length} />
        <StatCard label="Precisam atualizar" value={devices.filter((d) => getDeviceVersionStatus(d) === "desatualizado").length} tone="warning" />
      </section>
      <div className="panel">
        <h2>O que precisa de atencao</h2>
        <DataTable columns={["Urgencia", "Problema", "Totem", "Mensagem"]}>
          {operationalIssues.map((issue) => (
            <tr key={`${issue.deviceId}-${issue.type}`}>
              <td><Badge value={issue.severity} /></td>
              <td>{friendly(issue.type)}</td>
              <td>{issue.deviceLabel}</td>
              <td>{issue.message}</td>
            </tr>
          ))}
        </DataTable>
        {operationalIssues.length === 0 && <p className="hint">Nenhum problema operacional detectado nos totens cadastrados.</p>}
      </div>
      <div className="panel">
        <h2>Alertas recentes</h2>
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
      </div>
      <div className="panel">
        <h2>Historico de acoes</h2>
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
      </div>
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
      <section className="panel">
        <h2>Novo acesso</h2>
        <form className="inline-form" onSubmit={create}>
          <input type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="senha inicial" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            <option value="admin">Operador geral</option>
            <option value="super_admin">Dono do sistema</option>
            <option value="support">Suporte dos totens</option>
            <option value="finance">Financeiro</option>
          </select>
          <button className="primary">Criar</button>
        </form>
        {message && <p className="hint">{message}</p>}
      </section>
      <section className="panel">
        <DataTable columns={["Email", "Perfil", "Criado", ""]}>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td><Badge value={user.role} /></td>
              <td>{dateTime(user.created_at)}</td>
              <td><button className="danger" onClick={() => remove(user.id)}>Remover</button></td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Informacoes simples sobre publicacao e integracoes." />
      <div className="panel settings-list">
        <div><strong>App</strong><span>FanFrame Totens Admin</span></div>
        <div><strong>Publicacao do painel</strong><span>Vercel com app separado para administracao.</span></div>
        <div><strong>Chaves protegidas</strong><span>Replicate e PagBank ficam salvos no Supabase, fora do navegador.</span></div>
        <div><strong>Pagamento com cartao</strong><span>Roda no computador Windows do totem com PlugPag.</span></div>
      </div>
    </>
  );
}

function App() {
  const auth = useAuth();

  return (
    <Routes>
      <Route path="/login" element={auth.user && auth.role ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <Protected auth={auth}>
          <Layout auth={auth}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/times" element={<RoleGate role={auth.role} allowed={["super_admin", "admin"]}><Teams /></RoleGate>} />
              <Route path="/times/:slug" element={<RoleGate role={auth.role} allowed={["super_admin", "admin"]}><TeamForm /></RoleGate>} />
              <Route path="/totens" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><Devices role={auth.role} /></RoleGate>} />
              <Route path="/totens/:id" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><DeviceDetail role={auth.role} /></RoleGate>} />
              <Route path="/sessoes" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support", "finance"]}><Sessions /></RoleGate>} />
              <Route path="/pagamentos" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "finance"]}><Payments /></RoleGate>} />
              <Route path="/geracoes" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><Generations /></RoleGate>} />
              <Route path="/status" element={<RoleGate role={auth.role} allowed={["super_admin", "admin", "support"]}><StatusPage /></RoleGate>} />
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
