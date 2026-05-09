import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Database, Server, Hexagon } from "lucide-react";
import { SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";

export default function AdminSettings() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações Globais</h1>
          <p className="text-muted-foreground">Informações e configurações do sistema FanFrame</p>
        </div>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hexagon className="h-5 w-5" />
              FanFrame System
            </CardTitle>
            <CardDescription>Informações do sistema e links úteis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Projeto Supabase
                </div>
                <p className="text-xs text-muted-foreground font-mono">{SUPABASE_PROJECT_ID}</p>
                <a
                  href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Abrir Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  Edge Functions
                </div>
                <a
                  href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Gerenciar Functions <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">Configurações por Time</p>
              <p className="text-sm text-muted-foreground">
                Prompt de geração, token Replicate, URLs de compra e demais configurações específicas agora são gerenciadas dentro de cada provador em{" "}
                <a href="/admin/teams" className="text-primary hover:underline">Provadores</a>.
              </p>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">Links Úteis</p>
              <div className="flex flex-wrap gap-3">
                <a href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/functions`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  Secrets <ExternalLink className="h-3 w-3" />
                </a>
                <a href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/storage/buckets`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  Storage <ExternalLink className="h-3 w-3" />
                </a>
                <a href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/users`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  Usuários Admin <ExternalLink className="h-3 w-3" />
                </a>
                <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  Replicate Tokens <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
