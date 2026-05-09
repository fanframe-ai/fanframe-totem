import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TeamRow {
  id: string;
  slug: string;
  name: string;
  subdomain: string;
  primary_color: string;
  shirts: any[];
  backgrounds: any[];
  is_active: boolean;
  kiosk_enabled: boolean;
  kiosk_price_cents: number;
}

export default function AdminTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("id, slug, name, subdomain, primary_color, shirts, backgrounds, is_active, kiosk_enabled, kiosk_price_cents")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar times", description: error.message, variant: "destructive" });
    } else {
      setTeams((data as unknown as TeamRow[]) || []);
    }
    setLoading(false);
  };

  const handleDeactivate = async (team: TeamRow) => {
    if (!confirm(`Desativar "${team.name}"? Os dados serão preservados.`)) return;
    const { error } = await supabase.from("teams").update({ is_active: false } as any).eq("id", team.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Time desativado" });
    fetchTeams();
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Provadores</h1>
            <p className="text-sm text-muted-foreground">Gerencie os provadores virtuais de cada time</p>
          </div>
          <Button onClick={() => navigate("/admin/teams/novo")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Provador
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum provador cadastrado. Clique em "Novo Provador" para começar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {teams.map((team) => (
              <Card key={team.id} className={!team.is_active ? "opacity-50" : ""}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: team.primary_color || "#000" }}
                    >
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        /{team.slug} · {(team.shirts as any[])?.length || 0} camisas · {(team.backgrounds as any[])?.length || 0} cenários
                        {!team.is_active && " · Inativo"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/admin/teams/${team.slug}`)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    {team.is_active && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeactivate(team)}>
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
