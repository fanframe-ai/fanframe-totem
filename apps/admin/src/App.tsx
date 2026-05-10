import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
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
  user: any | null;
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
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > 5 * 60 * 1000;
}

function deviceHealthLabel(device: KioskDevice) {
  if (device.status === "disabled") return "disabled";
  if (device.status === "maintenance") return "maintenance";
  if (isOffline(device.last_seen_at)) return "offline";
  if (device.last_error_code) return "attention";
  return "online";
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

  const loadRole = async (user: any) => {
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
          <h1>Admin operacional</h1>
          <p>Controle times, totens, vendas e geracao IA remotamente.</p>
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
    { href: "/", Icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin", "admin", "support", "finance"] as Role[] },
    { href: "/times", Icon: Shirt, label: "Times", roles: ["super_admin", "admin"] as Role[] },
    { href: "/totens", Icon: Monitor, label: "Totens", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/sessoes", Icon: Activity, label: "Sessoes", roles: ["super_admin", "admin", "support", "finance"] as Role[] },
    { href: "/pagamentos", Icon: CreditCard, label: "Pagamentos", roles: ["super_admin", "admin", "finance"] as Role[] },
    { href: "/geracoes", Icon: ImageIcon, label: "Geracoes IA", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/status", Icon: AlertTriangle, label: "Status", roles: ["super_admin", "admin", "support"] as Role[] },
    { href: "/usuarios", Icon: Users, label: "Usuarios", roles: ["super_admin"] as Role[] },
    { href: "/configuracoes", Icon: Settings, label: "Configuracoes", roles: ["super_admin", "admin"] as Role[] },
  ].filter((item) => hasRole(auth.role, item.roles));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FF</div>
          <div>
            <strong>FanFrame</strong>
            <span>Totens Admin</span>
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
          <strong>{auth.role}</strong>
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

  return (
    <>
      <PageHeader title="Dashboard da rede" subtitle="Visao geral dos totens, vendas e operacao." />
      <section className="stats-grid">
        <StatCard label="Times ativos" value={teams.filter((t) => t.is_active).length} />
        <StatCard label="Totens ativos" value={devices.filter((d) => d.status === "active").length} />
        <StatCard label="Totens offline" value={devices.filter((d) => isOffline(d.last_seen_at)).length} tone="danger" />
        <StatCard label="Vendas hoje" value={paidToday.length} tone="success" />
        <StatCard label="Receita hoje" value={money(revenue)} tone="success" />
        <StatCard label="Pagamentos pendentes" value={payments.filter((p) => p.status === "pending").length} tone="warning" />
      </section>
      <section className="two-col">
        <div className="panel">
          <h2>Ultimas sessoes</h2>
          <DataTable columns={["Time", "Totem", "Status", "Valor", "Criada"]}>
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
          <h2>Totens por status</h2>
          <DataTable columns={["Totem", "Time", "Status", "Ultimo contato"]}>
            {devices.slice(0, 12).map((d) => (
              <tr key={d.id}>
                <td>{d.label || d.device_code}</td>
                <td>{d.teams?.name || "-"}</td>
                <td><Badge value={isOffline(d.last_seen_at) ? "offline" : d.status} /></td>
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
  return <span className={`badge ${value}`}>{value}</span>;
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
        subtitle="Branding, assets, preco, prompt e configuracao do totem por time."
        action={<Link className="primary link-button" to="/times/novo"><Plus size={16} /> Novo time</Link>}
      />
      <div className="panel">
        <DataTable columns={["Time", "Slug", "Totem", "Preco", "Assets", "Status", ""]}>
          {!loading && teams.map((team) => (
            <tr key={team.id}>
              <td><strong>{team.name}</strong></td>
              <td>{team.slug}</td>
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
      <div className="asset-grid">
        {assets.map((asset, index) => (
          <div className="asset-card" key={asset.id}>
            {asset.imageUrl && <img src={publicAssetUrl(asset.imageUrl)} alt={asset.name} />}
            <input placeholder="Nome" value={asset.name} onChange={(e) => update(index, { name: e.target.value })} />
            <input placeholder="Subtitulo" value={asset.subtitle || ""} onChange={(e) => update(index, { subtitle: e.target.value })} />
            {type === "shirts" && (
              <textarea placeholder="Descricao para prompt" value={asset.promptDescription || ""} onChange={(e) => update(index, { promptDescription: e.target.value })} />
            )}
            <label className="file-input">
              Upload imagem
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
              Visivel no totem
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

  const set = (key: keyof TeamRow, value: any) => setTeam((current) => ({ ...current, [key]: value }));

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
      ? await supabase.from("teams").insert(payload as any).select("slug").single()
      : await supabase.from("teams").update(payload as any).eq("id", team.id);

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (isNew) navigate(`/times/${(result.data as any).slug}`, { replace: true });
    setMessage("Time salvo com sucesso.");
  }

  return (
    <>
      <PageHeader title={isNew ? "Novo time" : `Editar ${team.name || ""}`} subtitle="Configure o time que sera usado por um ou mais totens." />
      <form className="form-grid" onSubmit={save}>
        <section className="panel form-section">
          <h2>Geral</h2>
          <label>Nome<input value={team.name || ""} onChange={(e) => { set("name", e.target.value); if (isNew) set("slug", slugify(e.target.value)); }} required /></label>
          <label>Slug<input value={team.slug || ""} onChange={(e) => set("slug", slugify(e.target.value))} disabled={!isNew} required /></label>
          <div className="two-fields">
            <label>Cor primaria<input type="color" value={team.primary_color || "#111827"} onChange={(e) => set("primary_color", e.target.value)} /></label>
            <label>Cor secundaria<input type="color" value={team.secondary_color || "#ffffff"} onChange={(e) => set("secondary_color", e.target.value)} /></label>
          </div>
          <label className="inline-check"><input type="checkbox" checked={team.is_active !== false} onChange={(e) => set("is_active", e.target.checked)} /> Time ativo</label>
        </section>

        <section className="panel form-section">
          <h2>Totem</h2>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_enabled !== false} onChange={(e) => set("kiosk_enabled", e.target.checked)} /> Habilitado para totem</label>
          <label>Preco em centavos<input type="number" min="0" value={team.kiosk_price_cents || 0} onChange={(e) => set("kiosk_price_cents", Number(e.target.value))} /></label>
          <label>Timeout em segundos<input type="number" min="15" max="180" value={team.kiosk_timeout_seconds || 60} onChange={(e) => set("kiosk_timeout_seconds", Number(e.target.value))} /></label>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_shirt_step !== false} onChange={(e) => set("kiosk_show_shirt_step", e.target.checked)} /> Mostrar escolha de camisa</label>
          <label className="inline-check"><input type="checkbox" checked={team.kiosk_show_background_step !== false} onChange={(e) => set("kiosk_show_background_step", e.target.checked)} /> Mostrar escolha de cenario</label>
        </section>

        <section className="panel form-section full">
          <h2>IA e branding</h2>
          <label>Prompt IA<textarea rows={4} value={team.generation_prompt || ""} onChange={(e) => set("generation_prompt", e.target.value)} /></label>
          <p className="hint">Token Replicate especifico por time nao e exibido para operadores. Use o token global salvo no Supabase ou configure direto com super admin.</p>
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
              Watermark
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                set("watermark_url", await uploadAsset(file, `${team.slug || "novo"}/branding/watermark.${file.name.split(".").pop() || "png"}`));
              }} />
            </label>
          </div>
        </section>

        <section className="panel full">
          <AssetEditor label="Camisas" teamSlug={team.slug || ""} type="shirts" assets={(team.shirts || []) as TeamAsset[]} onChange={(assets) => set("shirts", assets as any)} />
          <AssetEditor label="Cenarios" teamSlug={team.slug || ""} type="backgrounds" assets={(team.backgrounds || []) as TeamAsset[]} onChange={(assets) => set("backgrounds", assets as any)} />
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
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    status: "active",
    device_secret: "",
    support_pin: "",
  };
  const [form, setForm] = useState(emptyDeviceForm);
  const [message, setMessage] = useState("");
  const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string; deviceLabel: string; supportPin: string } | null>(null);
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
    const payload: any = {
      team_id: form.team_id,
      device_code: form.device_code,
      label: form.label,
      location: form.location,
      owner_name: form.owner_name,
      owner_email: form.owner_email,
      owner_phone: form.owner_phone,
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
      setInstallCode({ ...result, deviceLabel: device.label || device.device_code, supportPin });
      setMessage(`Codigo gerado para ${device.label || device.device_code}.`);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar codigo.");
    }
  }

  async function sendCommand(deviceId: string, command: CommandType) {
    setMessage("");
    try {
      await enqueueDeviceCommand(deviceId, command);
      setMessage(`Comando ${command} enviado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao enviar comando.");
    }
  }

  return (
    <>
      <PageHeader title="Totens" subtitle="Dispositivos Windows instalados em pontos fisicos." />
      {canEditDevices && (
        <section className="panel">
          <h2>Cadastrar ou atualizar totem</h2>
          <form className="inline-form" onSubmit={save}>
            <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} required>
              <option value="">Time</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input placeholder="device_code" value={form.device_code} onChange={(e) => setForm({ ...form, device_code: e.target.value })} required />
            <input placeholder="Nome/label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input placeholder="Localizacao" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input placeholder="Responsavel" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            <input placeholder="Email do responsavel" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
            <input placeholder="Telefone do responsavel" value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} />
            <input placeholder="Segredo do dispositivo" value={form.device_secret} onChange={(e) => setForm({ ...form, device_secret: e.target.value })} />
            <input
              placeholder="PIN tecnico (4 a 8 digitos)"
              inputMode="numeric"
              minLength={4}
              maxLength={8}
              pattern="[0-9]{4,8}"
              value={form.support_pin}
              onChange={(e) => setForm({ ...form, support_pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Ativo</option>
              <option value="maintenance">Manutencao</option>
              <option value="disabled">Desabilitado</option>
            </select>
            <button className="primary">Salvar</button>
          </form>
          <p className="hint">O PIN tecnico manual nao e exibido depois de salvo. Ao gerar um codigo de instalacao, o painel cria um PIN novo automaticamente para enviar ao dono do totem.</p>
          {message && <p className="hint">{message}</p>}
          {installCode && (
            <div className="notice">
              <strong>Codigo de instalacao: {installCode.code}</strong>
              <span>{installCode.deviceLabel} - PIN tecnico: {installCode.supportPin} - expira em {dateTime(installCode.expiresAt)}</span>
            </div>
          )}
        </section>
      )}
      {!canEditDevices && message && <div className="panel"><p className="hint">{message}</p></div>}
      <section className="panel">
        <DataTable columns={["Totem", "Time", "Responsavel", "Status", "Pareamento", "PIN", "Versao", "Ultimo contato", "Acoes"]}>
          {devices.map((d) => (
            <tr key={d.id}>
              <td><strong>{d.label || d.device_code}</strong><br /><span>{d.device_code}</span><br /><span>{d.location || "-"}</span></td>
              <td>{d.teams?.name || "-"}</td>
              <td>{d.owner_name || "-"}<br /><span>{d.owner_phone || d.owner_email || ""}</span></td>
              <td><Badge value={deviceHealthLabel(d)} /></td>
              <td><Badge value={d.install_status || "not_paired"} /></td>
              <td><Badge value={d.support_pin_hash ? "configurado" : "nao definido"} /></td>
              <td>{d.app_version || "-"}</td>
              <td>{dateTime(d.last_seen_at)}</td>
              <td className="actions-cell">
                <Link className="secondary link-button" to={`/totens/${d.id}`}>Abrir</Link>
                {canEditDevices && <button className="secondary" onClick={() => generateInstall(d)}>Codigo</button>}
                {canOperate && <button className="secondary" onClick={() => sendCommand(d.id, "sync_config")}>Sync</button>}
                {canOperate && <button className="secondary" onClick={() => sendCommand(d.id, "send_diagnostics")}>Diagnostico</button>}
                {canOperate && <button className="secondary" onClick={() => sendCommand(d.id, "restart_app")}>Reiniciar</button>}
                {canOperate && <button className="secondary" onClick={() => sendCommand(d.id, "exit_maintenance")}>Ativar</button>}
                {canOperate && <button className="danger" onClick={() => sendCommand(d.id, "enter_maintenance")}>Manutencao</button>}
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
  const [installCode, setInstallCode] = useState<{ code: string; expiresAt: string; supportPin: string } | null>(null);
  const canEditDevices = canManageBusiness(role);
  const canOperate = canSupportOperations(role);

  const load = async () => {
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
  };

  useEffect(() => { load(); }, [id]);

  async function generateInstall() {
    if (!device) return;
    setMessage("");
    try {
      const supportPin = await rotateDeviceSupportPin(device.id);
      const result = await createInstallCode(device.id, device.label || device.device_code);
      setInstallCode({ ...result, supportPin });
      setMessage("Codigo de instalacao gerado.");
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao gerar codigo.");
    }
  }

  async function sendCommand(command: CommandType) {
    if (!device) return;
    setMessage("");
    try {
      await enqueueDeviceCommand(device.id, command);
      setMessage(`Comando ${command} enviado.`);
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

  return (
    <>
      <PageHeader
        title={device.label || device.device_code}
        subtitle={`${device.teams?.name || "Sem time"} - ${device.location || "Sem localizacao"}`}
        action={<Link className="secondary link-button" to="/totens">Voltar</Link>}
      />

      <section className="stats-grid">
        <StatCard label="Status" value={deviceHealthLabel(device)} tone={deviceHealthLabel(device) === "online" ? "success" : "warning"} />
        <StatCard label="Pareamento" value={device.install_status || "not_paired"} />
        <StatCard label="Versao" value={device.app_version || "-"} />
        <StatCard label="Ultimo contato" value={dateTime(device.last_seen_at)} />
        <StatCard label="Erro" value={device.last_error_code || "-"} tone={device.last_error_code ? "danger" : "neutral"} />
        <StatCard label="Comandos pendentes" value={commands.filter((c) => c.status === "pending" || c.status === "running").length} />
      </section>

      <section className="panel device-actions">
        <div>
          <h2>Acoes remotas</h2>
          <p className="hint">O totem executa comandos quando sincronizar com a nuvem. Nao precisa acesso remoto ao Windows.</p>
        </div>
        <div className="actions-row">
          {canEditDevices && <button className="secondary" onClick={generateInstall}>Gerar codigo</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("sync_config")}>Sincronizar</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("send_diagnostics")}>Pedir diagnostico</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("restart_app")}>Reiniciar app</button>}
          {canOperate && <button className="secondary" onClick={() => sendCommand("exit_maintenance")}>Ativar</button>}
          {canOperate && <button className="danger" onClick={() => sendCommand("enter_maintenance")}>Manutencao</button>}
          {!canOperate && !canEditDevices && <span className="hint">Seu perfil permite somente visualizacao.</span>}
        </div>
        {message && <p className="hint">{message}</p>}
        {installCode && (
          <div className="notice">
            <strong>Codigo de instalacao: {installCode.code}</strong>
            <span>PIN tecnico: {installCode.supportPin} - expira em {dateTime(installCode.expiresAt)}</span>
          </div>
        )}
      </section>

      <section className="two-col">
        <div className="panel settings-list">
          <h2>Responsavel e dispositivo</h2>
          <div><strong>Codigo</strong><span>{device.device_code}</span></div>
          <div><strong>Responsavel</strong><span>{device.owner_name || "-"}</span></div>
          <div><strong>Email</strong><span>{device.owner_email || "-"}</span></div>
          <div><strong>Telefone</strong><span>{device.owner_phone || "-"}</span></div>
          <div><strong>PIN tecnico</strong><span>{device.support_pin_hash ? "Configurado" : "Nao definido"}</span></div>
          <div><strong>Canal</strong><span>{device.update_channel || "stable"}</span></div>
        </div>
        <div className="panel settings-list">
          <h2>Ultimo health</h2>
          <div><strong>Online</strong><span>{String(health.online ?? "-")}</span></div>
          <div><strong>Tela</strong><span>{String(health.currentScreen ?? "-")}</span></div>
          <div><strong>Versao reportada</strong><span>{String(health.appVersion ?? "-")}</span></div>
          <div><strong>Ultimo health</strong><span>{dateTime(device.last_health_at)}</span></div>
          <div><strong>Manutencao</strong><span>{device.maintenance_reason || "-"}</span></div>
        </div>
      </section>

      <section className="two-col">
        <div className="panel">
          <h2>Eventos recentes</h2>
          <DataTable columns={["Tipo", "Severidade", "Codigo", "Mensagem", "Criado"]}>
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
          <h2>Comandos</h2>
          <DataTable columns={["Comando", "Status", "Erro", "Criado", "Finalizado"]}>
            {commands.map((command) => (
              <tr key={command.id}>
                <td>{command.command_type}</td>
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
          <h2>Ultimas sessoes</h2>
          <DataTable columns={["Status", "Selecao", "Valor", "Erro", "Criada"]}>
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
          <DataTable columns={["Metodo", "Provider", "Status", "Valor", "Pago em"]}>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.method}</td>
                <td>{payment.provider}</td>
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
        <option value="">Todos os status</option>
        <option value="pending">Pendente</option>
        <option value="paid">Pago</option>
        <option value="completed">Completo</option>
        <option value="failed">Falhou</option>
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

  const load = async () => {
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
  };
  useEffect(() => { load(); }, [filters.teamId, filters.status, filters.days]);

  return (
    <>
      <PageHeader title="Sessoes e vendas" subtitle="Acompanhe cada atendimento do totem do pagamento ao QR Code." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <FilterBar filters={filters} setFilters={setFilters} teams={teams} />
      <div className="panel">
        <DataTable columns={["Time", "Totem", "Status", "Selecao", "Valor", "Erro", "Criada"]}>
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

  const load = async () => {
    const since = new Date(Date.now() - filters.days * 86400000).toISOString();
    let query = supabase.from("kiosk_payments").select("*, teams(name, slug)").gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    if (filters.teamId) query = query.eq("team_id", filters.teamId);
    if (filters.status) query = query.eq("status", filters.status);
    const { data } = await query;
    setRows((data || []) as KioskPayment[]);
  };
  useEffect(() => { load(); }, [filters.teamId, filters.status, filters.days]);

  return (
    <>
      <PageHeader title="Pagamentos" subtitle="PIX PagBank, cartao PlugPag e pagamentos simulados." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <FilterBar filters={filters} setFilters={setFilters} teams={teams} />
      <div className="panel">
        <DataTable columns={["Time", "Metodo", "Provider", "Status", "Valor", "Referencia", "Pago em"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.teams?.name || "-"}</td>
              <td>{row.method}</td>
              <td>{row.provider}</td>
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
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("generation_queue").select("*, teams(name, slug)").order("created_at", { ascending: false }).limit(300);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  return (
    <>
      <PageHeader title="Geracoes IA" subtitle="Fila de processamento, resultados e erros Replicate." action={<button className="secondary" onClick={load}><RefreshCw size={16} /> Atualizar</button>} />
      <div className="panel">
        <DataTable columns={["Time", "Origem", "Status", "Camisa", "Erro", "Criada", "Resultado"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.teams?.name || "-"}</td>
              <td>{row.source || "web"}</td>
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
  const [alerts, setAlerts] = useState<any[]>([]);
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  useEffect(() => {
    supabase.from("system_alerts").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAlerts(data || []));
    supabase.from("kiosk_devices").select("*, teams(name, slug)").order("last_seen_at", { ascending: false }).then(({ data }) => setDevices((data || []) as KioskDevice[]));
    supabase.from("kiosk_admin_audit_events").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setAuditEvents((data || []) as AdminAuditEvent[]));
  }, []);
  return (
    <>
      <PageHeader title="Status operacional" subtitle="Alertas, saude dos servicos e totens offline." />
      <section className="stats-grid">
        <StatCard label="Alertas abertos" value={alerts.filter((a) => !a.resolved).length} tone="warning" />
        <StatCard label="Totens offline" value={devices.filter((d) => isOffline(d.last_seen_at)).length} tone="danger" />
        <StatCard label="Em manutencao" value={devices.filter((d) => d.status === "maintenance").length} />
      </section>
      <div className="panel">
        <h2>Alertas recentes</h2>
        <DataTable columns={["Tipo", "Severidade", "Mensagem", "Resolvido", "Criado"]}>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td>{alert.type}</td>
              <td><Badge value={alert.severity} /></td>
              <td>{alert.message}</td>
              <td>{alert.resolved ? "Sim" : "Nao"}</td>
              <td>{dateTime(alert.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
      <div className="panel">
        <h2>Auditoria operacional</h2>
        <DataTable columns={["Acao", "Tabela", "Alvo", "Usuario", "Detalhe", "Criado"]}>
          {auditEvents.map((event) => (
            <tr key={event.id}>
              <td>{event.action}</td>
              <td>{event.target_table}</td>
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
  const [users, setUsers] = useState<any[]>([]);
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
        <div className="panel empty-state"><Shield size={28} /> Seu usuario nao pode gerenciar outros admins.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Crie operadores, suporte, financeiro e super admins." />
      <section className="panel">
        <h2>Novo usuario</h2>
        <form className="inline-form" onSubmit={create}>
          <input type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="senha inicial" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            <option value="admin">Operador admin</option>
            <option value="super_admin">Super admin</option>
            <option value="support">Suporte operacional</option>
            <option value="finance">Financeiro</option>
          </select>
          <button className="primary">Criar</button>
        </form>
        {message && <p className="hint">{message}</p>}
      </section>
      <section className="panel">
        <DataTable columns={["Email", "Role", "Criado", ""]}>
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
      <PageHeader title="Configuracoes" subtitle="Informacoes de deploy e integracoes do painel." />
      <div className="panel settings-list">
        <div><strong>App</strong><span>FanFrame Totens Admin</span></div>
        <div><strong>Deploy</strong><span>Vercel app separado em /apps/admin</span></div>
        <div><strong>Segredos</strong><span>Replicate e PagBank ficam em Supabase Secrets, nao no frontend.</span></div>
        <div><strong>PlugPag</strong><span>Executado localmente no PC Windows do totem.</span></div>
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
