import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Upload, Loader2, Check, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ASSET_URLS, BACKGROUNDS } from "@/config/fanframe";

// Local fallback for admin - mirrors the default team shirts
const SHIRTS = [
  { id: "manto-1", name: "Manto I – O Timão", subtitle: "O clássico alvinegro que carrega a história", imageUrl: ASSET_URLS.shirts["manto-1"] },
  { id: "manto-2", name: "Manto II – O Fiel", subtitle: "A força que vem da Fiel Torcida", imageUrl: ASSET_URLS.shirts["manto-2"] },
  { id: "manto-3", name: "Manto III – O Bando de Loucos", subtitle: "Atitude e paixão corintiana", imageUrl: ASSET_URLS.shirts["manto-3"] },
];

const BUCKET = "tryon-assets";

interface TextOverrides {
  [id: string]: { name?: string; subtitle?: string; hidden?: boolean };
}

function useTextOverrides(settingsKey: string, defaults: { id: string; name: string; subtitle: string }[]) {
  const [overrides, setOverrides] = useState<TextOverrides>({});
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", settingsKey)
        .maybeSingle();
      if (data?.value) {
        try {
          setOverrides(JSON.parse(data.value));
        } catch (error) {
          console.warn("[Assets] Invalid text overrides JSON", error);
        }
      }
      setLoaded(true);
    })();
  }, [settingsKey]);

  const save = useCallback(async (newOverrides: TextOverrides) => {
    setOverrides(newOverrides);
    const value = JSON.stringify(newOverrides);

    const { data: existing } = await supabase
      .from("system_settings")
      .select("id")
      .eq("key", settingsKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("system_settings").update({ value }).eq("key", settingsKey);
    } else {
      await supabase.from("system_settings").insert({
        key: settingsKey,
        value,
        description: `Text overrides for ${settingsKey}`,
      });
    }

    toast({ title: "Textos salvos!" });
  }, [settingsKey, toast]);

  const getName = (id: string) => overrides[id]?.name ?? defaults.find(d => d.id === id)?.name ?? "";
  const getSubtitle = (id: string) => overrides[id]?.subtitle ?? defaults.find(d => d.id === id)?.subtitle ?? "";
  const isVisible = (id: string) => overrides[id]?.hidden !== true;

  return { overrides, save, getName, getSubtitle, isVisible, loaded };
}

function AssetCard({
  id,
  label,
  subtitle,
  currentUrl,
  storagePath,
  aspectRatio = "3/4",
  editable = false,
  visible = true,
  onTextChange,
  onVisibilityChange,
}: {
  id?: string;
  label: string;
  subtitle?: string;
  currentUrl: string;
  storagePath: string;
  aspectRatio?: string;
  editable?: boolean;
  visible?: boolean;
  onTextChange?: (name: string, subtitle: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(label);
  const [editSubtitle, setEditSubtitle] = useState(subtitle || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setEditName(label);
    setEditSubtitle(subtitle || "");
  }, [label, subtitle]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setDone(false);
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: "60", upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      setPreviewUrl(urlData.publicUrl + "?t=" + Date.now());
      setDone(true);
      toast({ title: "Imagem atualizada!", description: label });
    } catch (err: unknown) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Falha ao enviar imagem", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSaveText = () => {
    onTextChange?.(editName, editSubtitle);
    setEditing(false);
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden transition-opacity", !visible && "opacity-50")}>
      <div className="relative bg-muted" style={{ aspectRatio }}>
        <img
          src={previewUrl}
          alt={label}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
        />
        {done && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="p-3">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome"
              className="h-8 text-sm"
            />
            <Input
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Subtítulo"
              className="h-8 text-sm"
            />
            <Button size="sm" className="w-full" onClick={handleSaveText}>
              <Save className="h-4 w-4 mr-1" /> Salvar textos
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-1">
              <div>
                <h3 className="font-semibold text-sm">{label}</h3>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              {editable && (
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {onVisibilityChange && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Visível para clientes</span>
                <Switch checked={visible} onCheckedChange={onVisibilityChange} />
              </div>
            )}
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploading ? "Enviando..." : "Substituir imagem"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminAssets() {
  const shirtDefaults = SHIRTS.map(s => ({ id: s.id, name: s.name, subtitle: s.subtitle }));
  const bgDefaults = BACKGROUNDS.map(b => ({ id: b.id, name: b.name, subtitle: b.subtitle }));

  const shirts = useTextOverrides("shirts_text_overrides", shirtDefaults);
  const bgs = useTextOverrides("backgrounds_text_overrides", bgDefaults);

  const handleShirtTextChange = (shirtId: string) => (name: string, subtitle: string) => {
    const newOverrides = { ...shirts.overrides, [shirtId]: { ...shirts.overrides[shirtId], name, subtitle } };
    shirts.save(newOverrides);
  };

  const handleShirtVisibility = (shirtId: string) => (visible: boolean) => {
    const newOverrides = { ...shirts.overrides, [shirtId]: { ...shirts.overrides[shirtId], hidden: !visible } };
    shirts.save(newOverrides);
  };

  const handleBgTextChange = (bgId: string) => (name: string, subtitle: string) => {
    const newOverrides = { ...bgs.overrides, [bgId]: { ...bgs.overrides[bgId], name, subtitle } };
    bgs.save(newOverrides);
  };

  const handleBgVisibility = (bgId: string) => (visible: boolean) => {
    const newOverrides = { ...bgs.overrides, [bgId]: { ...bgs.overrides[bgId], hidden: !visible } };
    bgs.save(newOverrides);
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gerenciar Assets</h1>
          <p className="text-sm text-muted-foreground">Edite as imagens e textos do provador virtual</p>
        </div>

        <Tabs defaultValue="tutorial" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tutorial">Antes / Depois</TabsTrigger>
            <TabsTrigger value="shirts">Camisas</TabsTrigger>
            <TabsTrigger value="backgrounds">Cenários</TabsTrigger>
          </TabsList>

          <TabsContent value="tutorial">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AssetCard
                label="Imagem Antes"
                subtitle="Foto de exemplo sem o manto"
                currentUrl={ASSET_URLS.tutorial.before}
                storagePath="tutorial/before.jpg"
                aspectRatio="3/4"
              />
              <AssetCard
                label="Imagem Depois"
                subtitle="Foto de exemplo com o manto"
                currentUrl={ASSET_URLS.tutorial.after}
                storagePath="tutorial/after.png"
                aspectRatio="3/4"
              />
            </div>
          </TabsContent>

          <TabsContent value="shirts">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SHIRTS.map((shirt) => (
                <AssetCard
                  key={shirt.id}
                  id={shirt.id}
                  label={shirts.getName(shirt.id)}
                  subtitle={shirts.getSubtitle(shirt.id)}
                  currentUrl={shirt.imageUrl}
                  storagePath={`shirts/${shirt.id}.png`}
                  aspectRatio="1/1"
                  editable
                  visible={shirts.isVisible(shirt.id)}
                  onTextChange={handleShirtTextChange(shirt.id)}
                  onVisibilityChange={handleShirtVisibility(shirt.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="backgrounds">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BACKGROUNDS.map((bg) => (
                <AssetCard
                  key={bg.id}
                  id={bg.id}
                  label={bgs.getName(bg.id)}
                  subtitle={bgs.getSubtitle(bg.id)}
                  currentUrl={bg.imageUrl}
                  storagePath={`backgrounds/${bg.id}.${bg.id === "mural" ? "png" : "jpg"}`}
                  aspectRatio="16/9"
                  editable
                  visible={bgs.isVisible(bg.id)}
                  onTextChange={handleBgTextChange(bg.id)}
                  onVisibilityChange={handleBgVisibility(bg.id)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
