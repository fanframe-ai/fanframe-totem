import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, Check, Pencil, Save, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "tryon-assets";

export interface AssetCardProps {
  label: string;
  subtitle?: string;
  promptDescription?: string;
  currentUrl: string;
  storagePath: string;
  aspectRatio?: string;
  editable?: boolean;
  visible?: boolean;
  onTextChange?: (name: string, subtitle: string, promptDescription?: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onRemove?: () => void;
  onImageUploaded?: (publicUrl: string) => void;
}

export function AssetCard({
  label,
  subtitle,
  promptDescription,
  currentUrl,
  storagePath,
  aspectRatio = "3/4",
  editable = false,
  visible = true,
  onTextChange,
  onVisibilityChange,
  onRemove,
  onImageUploaded,
}: AssetCardProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(label);
  const [editSubtitle, setEditSubtitle] = useState(subtitle || "");
  const [editPrompt, setEditPrompt] = useState(promptDescription || "");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setEditName(label);
    setEditSubtitle(subtitle || "");
    setEditPrompt(promptDescription || "");
  }, [label, subtitle, promptDescription]);

  useEffect(() => {
    setPreviewUrl(currentUrl);
  }, [currentUrl]);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Apenas imagens são aceitas", variant: "destructive" });
      return;
    }
    setUploading(true);
    setDone(false);
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: "60", upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const newUrl = urlData.publicUrl + "?t=" + Date.now();
      setPreviewUrl(newUrl);
      setDone(true);
      onImageUploaded?.(urlData.publicUrl);
      toast({ title: "Imagem atualizada!", description: label });
    } catch (err: unknown) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Falha ao enviar imagem", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleSaveText = () => {
    onTextChange?.(editName, editSubtitle, editPrompt);
    setEditing(false);
  };

  const hasImage = previewUrl && previewUrl !== "/placeholder.svg";

  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl overflow-hidden transition-all",
        isDragging ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border",
        !visible && "opacity-50"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="relative bg-muted" style={{ aspectRatio }}>
        {hasImage ? (
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm">{isDragging ? "Solte a imagem aqui" : "Arraste ou clique para enviar"}</span>
          </div>
        )}
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
            {promptDescription !== undefined && (
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Descrição para o prompt de IA (ex: camisa branca com listras pretas)"
                className="text-sm min-h-[60px]"
                rows={2}
              />
            )}
            <Button size="sm" className="w-full" onClick={handleSaveText}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{label || "Sem nome"}</h3>
                {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {editable && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onRemove && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {onVisibilityChange && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Visível</span>
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
          {uploading ? "Enviando..." : hasImage ? "Substituir imagem" : "Enviar imagem"}
        </Button>
      </div>
    </div>
  );
}
