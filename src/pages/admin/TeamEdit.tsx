import { useState, useCallback, useEffect } from "react";
import { TestLinksManager } from "@/components/admin/TestLinksManager";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AssetCard } from "@/components/admin/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/tryon-assets`;

interface ShirtItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  promptDescription: string;
  visible: boolean;
}

interface BackgroundItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  assetPath: string;
  visible: boolean;
}

interface TeamData {
  id?: string;
  slug: string;
  name: string;
  subdomain: string;
  replicate_api_token: string | null;
  generation_prompt: string | null;
  shirts: ShirtItem[];
  backgrounds: BackgroundItem[];
  tutorial_assets: { before: string; after: string };
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  watermark_url: string | null;
  is_active: boolean;
  text_overrides: Record<string, string>;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
  kiosk_currency: string;
  kiosk_timeout_seconds: number;
  kiosk_default_mode: string;
  kiosk_show_shirt_step: boolean;
  kiosk_show_background_step: boolean;
}

const generateHash = () => Math.random().toString(36).substring(2, 8);

const emptyTeam: TeamData = {
  slug: "",
  name: "",
  subdomain: "",
  replicate_api_token: null,
  generation_prompt: null,
  shirts: [],
  backgrounds: [],
  tutorial_assets: { before: "", after: "" },
  primary_color: "#000000",
  secondary_color: "#FFFFFF",
  logo_url: null,
  watermark_url: null,
  is_active: true,
  kiosk_enabled: false,
  kiosk_price_cents: 2500,
  kiosk_currency: "BRL",
  kiosk_timeout_seconds: 60,
  kiosk_default_mode: "standard",
  kiosk_show_shirt_step: true,
  kiosk_show_background_step: true,
  text_overrides: {
    welcome_title: "VISTA A CAMISA",
    welcome_cta: "EXPERIMENTAR AGORA",
    welcome_subtitle: "IA que veste o manto do {time} em você. Resultado realista em segundos.",
    welcome_social_proof: "+ de 10.000 torcedores já vestiram",
    tutorial_title: "Como funciona",
    tutorial_subtitle: "Em 3 passos, você se vê vestindo o manto.",
    shirt_title: "Qual manto você vai vestir?",
    background_title: "Escolha o cenário",
    upload_title: "Agora, sua foto",
    upload_subtitle: "Corpo inteiro, roupa clara",
    upload_cta: "ENVIAR FOTO",
  },
};

export default function TeamEdit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = slug === "novo";

  const [form, setForm] = useState<TeamData>(emptyTeam);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const loadTeam = useCallback(async (teamSlug: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("slug", teamSlug)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Time não encontrado", variant: "destructive" });
      navigate("/admin/teams");
      return;
    }

    const teamData: TeamData = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      subdomain: data.subdomain,
      replicate_api_token: data.replicate_api_token,
      generation_prompt: data.generation_prompt,
      shirts: (data.shirts as unknown as ShirtItem[]) || [],
      backgrounds: (data.backgrounds as unknown as BackgroundItem[]) || [],
      tutorial_assets: (data.tutorial_assets as { before: string; after: string }) || { before: "", after: "" },
      primary_color: data.primary_color || "#000000",
      secondary_color: data.secondary_color || "#FFFFFF",
      logo_url: data.logo_url,
      watermark_url: data.watermark_url,
      is_active: data.is_active ?? true,
      text_overrides: (data.text_overrides as Record<string, string>) || {},
      kiosk_enabled: data.kiosk_enabled ?? false,
      kiosk_price_cents: data.kiosk_price_cents ?? 2500,
      kiosk_currency: data.kiosk_currency || "BRL",
      kiosk_timeout_seconds: data.kiosk_timeout_seconds ?? 60,
      kiosk_default_mode: data.kiosk_default_mode || "standard",
      kiosk_show_shirt_step: data.kiosk_show_shirt_step ?? true,
      kiosk_show_background_step: data.kiosk_show_background_step ?? true,
    };

    setForm(teamData);
    setLoading(false);
  }, [navigate, toast]);

  useEffect(() => {
    if (!isNew && slug) {
      loadTeam(slug);
    }
  }, [isNew, loadTeam, slug]);

  const updateField = <K extends keyof TeamData>(field: K, value: TeamData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Shirts ---
  const addShirt = () => {
    const id = `camisa-${Date.now()}`;
    const newShirt: ShirtItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      promptDescription: "",
      visible: true,
    };
    updateField("shirts", [...form.shirts, newShirt]);
  };

  const updateShirt = (index: number, updates: Partial<ShirtItem>) => {
    const shirts = [...form.shirts];
    shirts[index] = { ...shirts[index], ...updates };
    updateField("shirts", shirts);
  };

  const removeShirt = (index: number) => {
    updateField("shirts", form.shirts.filter((_, i) => i !== index));
  };

  // --- Backgrounds ---
  const addBackground = () => {
    const id = `cenario-${Date.now()}`;
    const newBg: BackgroundItem = {
      id,
      name: "",
      subtitle: "",
      imageUrl: "",
      assetPath: "",
      visible: true,
    };
    updateField("backgrounds", [...form.backgrounds, newBg]);
  };

  const updateBackground = (index: number, updates: Partial<BackgroundItem>) => {
    const bgs = [...form.backgrounds];
    bgs[index] = { ...bgs[index], ...updates };
    updateField("backgrounds", bgs);
  };

  const removeBackground = (index: number) => {
    updateField("backgrounds", form.backgrounds.filter((_, i) => i !== index));
  };

  // --- Save ---
  const handleSave = async () => {
    // Auto-fill required fields with defaults if empty
    const slug = form.slug || `time-${generateHash()}`;
    const name = form.name || "Novo Provador";
    const subdomain = form.subdomain || slug;

    const formToSave = { ...form, slug, name, subdomain };

    setSaving(true);

    const payload = {
      slug: formToSave.slug,
      name: formToSave.name,
      subdomain: formToSave.subdomain,
      replicate_api_token: formToSave.replicate_api_token || null,
      generation_prompt: formToSave.generation_prompt || null,
      shirts: formToSave.shirts,
      backgrounds: formToSave.backgrounds,
      tutorial_assets: formToSave.tutorial_assets,
      primary_color: formToSave.primary_color,
      secondary_color: formToSave.secondary_color,
      logo_url: formToSave.logo_url || null,
      watermark_url: formToSave.watermark_url || null,
      is_active: formToSave.is_active,
      text_overrides: formToSave.text_overrides,
      kiosk_enabled: formToSave.kiosk_enabled,
      kiosk_price_cents: formToSave.kiosk_price_cents,
      kiosk_currency: formToSave.kiosk_currency,
      kiosk_timeout_seconds: formToSave.kiosk_timeout_seconds,
      kiosk_default_mode: formToSave.kiosk_default_mode,
      kiosk_show_shirt_step: formToSave.kiosk_show_shirt_step,
      kiosk_show_background_step: formToSave.kiosk_show_background_step,
    };

    try {
      if (isNew) {
        const { error } = await supabase.from("teams").insert(payload as never);
        if (error) throw error;
        toast({ title: "Time criado com sucesso!" });
        navigate("/admin/teams");
      } else {
        const { error } = await supabase.from("teams").update(payload as never).eq("id", form.id!);
        if (error) throw error;
        toast({ title: "Time atualizado!" });
      }
    } catch (err: unknown) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Falha ao salvar time", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/teams")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {isNew ? "Criar Novo Provador" : `Editar: ${form.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew ? "Configure todos os detalhes do novo time" : `franframe.vercel.app/${form.slug}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => updateField("is_active", v)} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Ativo" : "Inativo"}</span>
            </div>
            {!isNew && form.slug && (
              <Button variant="outline" asChild>
                <a href={`${window.location.origin}/${form.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="integration">Integração</TabsTrigger>
            <TabsTrigger value="kiosk">Totem</TabsTrigger>
            <TabsTrigger value="shirts">Camisas</TabsTrigger>
            <TabsTrigger value="backgrounds">Cenários</TabsTrigger>
            <TabsTrigger value="texts">Textos</TabsTrigger>
            <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="test-links">Links Teste</TabsTrigger>
          </TabsList>

          {/* === GERAL === */}
          <TabsContent value="general">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Time *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        updateField("name", name);
                        if (isNew) {
                          const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                          if (base) {
                            updateField("slug", `${base}-${generateHash()}`);
                          } else {
                            updateField("slug", "");
                          }
                        }
                      }}
                      placeholder="São Paulo FC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (URL) *</Label>
                    <Input
                      value={form.slug}
                      onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="saopaulo-a1b2c3"
                      disabled={!isNew}
                    />
                    <p className="text-xs text-muted-foreground">Gerado automaticamente com hash de segurança. Pode ser editado antes de salvar.</p>
                  </div>
                </div>
                {form.slug && (
                  <div className="space-y-2">
                    <Label>URL do Provador</Label>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                      <span className="text-sm text-muted-foreground">franframe.vercel.app/</span>
                      <span className="text-sm font-medium">{form.slug}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">URL pública onde o provador será acessado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INTEGRAÇÃO === */}
          {/* === TOTEM === */}
          <TabsContent value="kiosk">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Modo Totem</h2>
                    <p className="text-sm text-muted-foreground">Habilita este time para uso no software desktop Windows.</p>
                  </div>
                  <Switch checked={form.kiosk_enabled} onCheckedChange={(v) => updateField("kiosk_enabled", v)} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Preco (centavos)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.kiosk_price_cents}
                      onChange={(e) => updateField("kiosk_price_cents", Number(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">2500 = R$ 25,00</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Input value={form.kiosk_currency} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout (segundos)</Label>
                    <Input
                      type="number"
                      min={15}
                      max={180}
                      value={form.kiosk_timeout_seconds}
                      onChange={(e) => updateField("kiosk_timeout_seconds", Number(e.target.value) || 60)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <Label>Mostrar escolha de camisa</Label>
                      <p className="text-xs text-muted-foreground">Se desligado, usa a primeira camisa visivel.</p>
                    </div>
                    <Switch checked={form.kiosk_show_shirt_step} onCheckedChange={(v) => updateField("kiosk_show_shirt_step", v)} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <Label>Mostrar escolha de cenario</Label>
                      <p className="text-xs text-muted-foreground">Se desligado, usa o primeiro cenario visivel.</p>
                    </div>
                    <Switch checked={form.kiosk_show_background_step} onCheckedChange={(v) => updateField("kiosk_show_background_step", v)} />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted p-4">
                  <Label>Configuracao local do PC</Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    Instale o app Electron no Windows e configure <code>kiosk.config.json</code> com <code>teamSlug: "{form.slug || "slug-do-time"}"</code>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integration">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Token Replicate API</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={form.replicate_api_token || ""}
                      onChange={(e) => updateField("replicate_api_token", e.target.value || null)}
                      placeholder="r8_... (vazio = usa token global)"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Se vazio, usa o token global do sistema</p>
                </div>

                <div className="space-y-2">
                  <Label>Prompt de Geração</Label>
                  <Textarea
                    value={form.generation_prompt || ""}
                    onChange={(e) => updateField("generation_prompt", e.target.value || null)}
                    placeholder="Deixe vazio para usar o prompt padrão..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Prompt customizado para a IA de troca de roupa</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CAMISAS === */}
          <TabsContent value="shirts">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Camisas do Time</h2>
                  <p className="text-sm text-muted-foreground">{form.shirts.length} camisa(s) cadastrada(s)</p>
                </div>
                <Button onClick={addShirt}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Camisa
                </Button>
              </div>

              {form.shirts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma camisa cadastrada. Clique em "Adicionar Camisa" para começar.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {form.shirts.map((shirt, index) => (
                    <AssetCard
                      key={shirt.id}
                      label={shirt.name}
                      subtitle={shirt.subtitle}
                      promptDescription={shirt.promptDescription}
                      currentUrl={shirt.imageUrl || "/placeholder.svg"}
                      storagePath={`${form.slug}/shirts/${shirt.id}.png`}
                      aspectRatio="1/1"
                      editable
                      visible={shirt.visible !== false}
                      onTextChange={(name, subtitle, promptDesc) =>
                        updateShirt(index, { name, subtitle, promptDescription: promptDesc })
                      }
                      onVisibilityChange={(v) => updateShirt(index, { visible: v })}
                      onRemove={() => removeShirt(index)}
                      onImageUploaded={(url) =>
                        updateShirt(index, { imageUrl: url, assetPath: url })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === CENÁRIOS === */}
          <TabsContent value="backgrounds">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Cenários</h2>
                  <p className="text-sm text-muted-foreground">{form.backgrounds.length} cenário(s) cadastrado(s)</p>
                </div>
                <Button onClick={addBackground}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Cenário
                </Button>
              </div>

              {form.backgrounds.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhum cenário cadastrado. Clique em "Adicionar Cenário" para começar.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {form.backgrounds.map((bg, index) => (
                    <AssetCard
                      key={bg.id}
                      label={bg.name}
                      subtitle={bg.subtitle}
                      currentUrl={bg.imageUrl || "/placeholder.svg"}
                      storagePath={`${form.slug}/backgrounds/${bg.id}.png`}
                      aspectRatio="16/9"
                      editable
                      visible={bg.visible !== false}
                      onTextChange={(name, subtitle) =>
                        updateBackground(index, { name, subtitle })
                      }
                      onVisibilityChange={(v) => updateBackground(index, { visible: v })}
                      onRemove={() => removeBackground(index)}
                      onImageUploaded={(url) =>
                        updateBackground(index, { imageUrl: url, assetPath: url })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === TEXTOS === */}
          <TabsContent value="texts">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Textos do Provador</h2>
                  <p className="text-sm text-muted-foreground">
                    Personalize os textos exibidos em cada tela. Deixe vazio para usar o texto padrão.
                  </p>
                </div>

                {/* Welcome */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela Inicial</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.welcome_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_title: e.target.value || undefined })}
                        placeholder="VISTA A CAMISA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Botão CTA</Label>
                      <Input
                        value={form.text_overrides.welcome_cta || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_cta: e.target.value || undefined })}
                        placeholder="EXPERIMENTAR AGORA"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Input
                      value={form.text_overrides.welcome_subtitle || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_subtitle: e.target.value || undefined })}
                      placeholder="IA que veste o manto do {time} em você. Resultado realista em segundos."
                    />
                    <p className="text-xs text-muted-foreground">Use {"{time}"} para inserir o nome do time automaticamente</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prova Social</Label>
                    <Input
                      value={form.text_overrides.welcome_social_proof || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, welcome_social_proof: e.target.value || undefined })}
                      placeholder="+ de 10.000 torcedores já vestiram"
                    />
                  </div>
                </div>

                {/* Tutorial */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela Tutorial</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.tutorial_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, tutorial_title: e.target.value || undefined })}
                        placeholder="Como funciona"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={form.text_overrides.tutorial_subtitle || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, tutorial_subtitle: e.target.value || undefined })}
                        placeholder="Em 3 passos, você se vê vestindo o manto."
                      />
                    </div>
                  </div>
                </div>

                {/* Shirt Selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Seleção de Camisa</h3>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={form.text_overrides.shirt_title || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, shirt_title: e.target.value || undefined })}
                      placeholder="Qual manto você vai vestir?"
                    />
                  </div>
                </div>

                {/* Background Selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Seleção de Cenário</h3>
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={form.text_overrides.background_title || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, background_title: e.target.value || undefined })}
                      placeholder="Escolha o cenário"
                    />
                  </div>
                </div>

                {/* Upload */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Tela de Upload</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={form.text_overrides.upload_title || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_title: e.target.value || undefined })}
                        placeholder="Agora, sua foto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={form.text_overrides.upload_subtitle || ""}
                        onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_subtitle: e.target.value || undefined })}
                        placeholder="Corpo inteiro, roupa clara"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Botão CTA</Label>
                    <Input
                      value={form.text_overrides.upload_cta || ""}
                      onChange={(e) => updateField("text_overrides", { ...form.text_overrides, upload_cta: e.target.value || undefined })}
                      placeholder="VESTIR O MANTO"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TUTORIAL === */}
          <TabsContent value="tutorial">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Imagens do Tutorial</h2>
                <p className="text-sm text-muted-foreground">Antes e depois exibidos no tutorial do provador</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AssetCard
                  label="Imagem Antes"
                  subtitle="Foto de exemplo sem a camisa"
                  currentUrl={form.tutorial_assets?.before || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/before.jpg`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, before: url })
                  }
                />
                <AssetCard
                  label="Imagem Depois"
                  subtitle="Foto de exemplo com a camisa"
                  currentUrl={form.tutorial_assets?.after || "/placeholder.svg"}
                  storagePath={`${form.slug}/tutorial/after.png`}
                  aspectRatio="3/4"
                  onImageUploaded={(url) =>
                    updateField("tutorial_assets", { ...form.tutorial_assets, after: url })
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* === BRANDING === */}
          <TabsContent value="branding">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => updateField("primary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.primary_color} onChange={(e) => updateField("primary_color", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) => updateField("secondary_color", e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input value={form.secondary_color} onChange={(e) => updateField("secondary_color", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Color preview */}
                <div className="flex gap-4">
                  <div
                    className="rounded-lg h-20 flex-1 flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: form.primary_color, color: form.secondary_color }}
                  >
                    {form.name || "Nome do Time"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Label>Logo do Time</Label>
                    <AssetCard
                      label="Logo"
                      subtitle="Exibido no topo do provador"
                      currentUrl={form.logo_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/logo.png`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("logo_url", url)}
                      onRemove={form.logo_url ? () => updateField("logo_url", null) : undefined}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Marca d'água</Label>
                    <AssetCard
                      label="Watermark"
                      subtitle="Aplicada nas imagens geradas"
                      currentUrl={form.watermark_url || "/placeholder.svg"}
                      storagePath={`${form.slug}/branding/watermark.webp`}
                      aspectRatio="1/1"
                      onImageUploaded={(url) => updateField("watermark_url", url)}
                      onRemove={form.watermark_url ? () => updateField("watermark_url", null) : undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === LINKS DE TESTE === */}
          <TabsContent value="test-links">
            {form.id ? (
              <TestLinksManager teamId={form.id} teamSlug={form.slug} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Salve o provador primeiro para criar links de teste.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
