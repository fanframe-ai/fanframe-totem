import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Loader2, Link as LinkIcon, ExternalLink } from "lucide-react";

interface TestLink {
  id: string;
  token: string;
  label: string;
  credits_total: number;
  credits_used: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface TestLinksManagerProps {
  teamId: string;
  teamSlug: string;
}

export function TestLinksManager({ teamId, teamSlug }: TestLinksManagerProps) {
  const [links, setLinks] = useState<TestLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("Link de teste");
  const [newCredits, setNewCredits] = useState(5);
  const { toast } = useToast();

  const publishedUrl = "https://franframe.vercel.app";

  const fetchLinks = useCallback(async () => {
    const { data, error } = await supabase
      .from("test_links")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLinks(data as TestLink[]);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    if (teamId) fetchLinks();
  }, [teamId, fetchLinks]);

  const handleCreate = async () => {
    if (newCredits < 1) {
      toast({ title: "Créditos inválidos", description: "Mínimo 1 crédito", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("test_links").insert({
      team_id: teamId,
      label: newLabel || "Link de teste",
      credits_total: newCredits,
    } as never);

    if (error) {
      toast({ title: "Erro ao criar link", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link de teste criado!" });
      setNewLabel("Link de teste");
      setNewCredits(5);
      fetchLinks();
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("test_links").update({ is_active: active } as never).eq("id", id);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("test_links").delete().eq("id", id);
    fetchLinks();
    toast({ title: "Link removido" });
  };

  const buildCleanUrl = (token: string) => `${publishedUrl}/${teamSlug}-${token}`;
  const buildDirectUrl = (token: string) => `${window.location.origin}/${teamSlug}?test_token=${token}`;

  const copyLink = (token: string) => {
    const url = buildCleanUrl(token);
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  const openLink = (token: string) => {
    window.open(`${publishedUrl}/${teamSlug}?test_token=${token}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create new */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Criar novo link de teste
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Nome / Identificação</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Teste para diretoria"
              />
            </div>
            <div className="space-y-2">
              <Label>Créditos disponíveis</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={newCredits}
                onChange={(e) => setNewCredits(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum link de teste criado ainda.</p>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const remaining = link.credits_total - link.credits_used;
            const exhausted = remaining <= 0;
            return (
              <Card key={link.id} className={!link.is_active || exhausted ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{link.label}</span>
                        {!link.is_active && <Badge variant="secondary">Desativado</Badge>}
                        {exhausted && link.is_active && <Badge variant="destructive">Esgotado</Badge>}
                        {link.is_active && !exhausted && <Badge variant="default">Ativo</Badge>}
                      </div>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded block truncate mt-1">
                        {teamSlug}-{link.token}
                      </code>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Créditos: {link.credits_used}/{link.credits_total} usados ({remaining} restantes)</span>
                        <span>•</span>
                        <span>Criado: {new Date(link.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={link.is_active}
                        onCheckedChange={(v) => handleToggle(link.id, v)}
                      />
                      <Button size="icon" variant="ghost" onClick={() => copyLink(link.token)} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openLink(link.token)} title="Abrir link">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(link.id)} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
