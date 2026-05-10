import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Loader2,
  Database,
  Cpu,
  Globe,
  Image,
  Server,
  Wifi,
  Activity,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "checking" | "unknown";

interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  responseTime?: number;
  lastChecked: Date | null;
  icon: React.ReactNode;
  uptime: number;
  error?: string;
}

interface HealthCheck {
  id: string;
  service_id: string;
  service_name: string;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface HealthCheckStats {
  service_id: string;
  uptime_percentage: number;
}

interface DayStatus {
  date: Date;
  status: ServiceStatus;
  checks: number;
  operational: number;
}

interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  createdAt: Date;
  affectedServices: string[];
  message: string;
}

const statusConfig: Record<ServiceStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  operational: { 
    label: "Operacional", 
    color: "text-success", 
    bgColor: "bg-success/10",
    icon: <CheckCircle2 className="h-5 w-5" />
  },
  degraded: { 
    label: "Degradado", 
    color: "text-warning", 
    bgColor: "bg-warning/10",
    icon: <AlertTriangle className="h-5 w-5" />
  },
  partial_outage: { 
    label: "Interrupção Parcial", 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    icon: <AlertTriangle className="h-5 w-5" />
  },
  major_outage: { 
    label: "Fora do Ar", 
    color: "text-destructive", 
    bgColor: "bg-destructive/10",
    icon: <XCircle className="h-5 w-5" />
  },
  checking: { 
    label: "Verificando...", 
    color: "text-muted-foreground", 
    bgColor: "bg-muted/10",
    icon: <Loader2 className="h-5 w-5 animate-spin" />
  },
  unknown: { 
    label: "Sem dados", 
    color: "text-muted-foreground", 
    bgColor: "bg-muted/10",
    icon: <Clock className="h-5 w-5" />
  },
};

const incidentStatusConfig = {
  investigating: { label: "Investigando", color: "text-destructive", bgColor: "bg-destructive/10" },
  identified: { label: "Identificado", color: "text-warning", bgColor: "bg-warning/10" },
  monitoring: { label: "Monitorando", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  resolved: { label: "Resolvido", color: "text-success", bgColor: "bg-success/10" },
};

const serviceIcons: Record<string, React.ReactNode> = {
  database: <Database className="h-5 w-5" />,
  auth: <Server className="h-5 w-5" />,
  "edge-functions": <Cpu className="h-5 w-5" />,
  realtime: <Wifi className="h-5 w-5" />,
  openai: <Image className="h-5 w-5" />,
  cdn: <Globe className="h-5 w-5" />,
};

export default function AdminSystemStatus() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [uptimeHistory, setUptimeHistory] = useState<Record<string, DayStatus[]>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>("checking");
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  const fetchHealthData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Fetch latest health check per service
      const { data: latestChecks, error: latestError } = await supabase
        .from("health_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (latestError) throw latestError;

      // Group by service to get latest status
      const serviceMap = new Map<string, HealthCheck>();
      (latestChecks as HealthCheck[] || []).forEach(check => {
        if (!serviceMap.has(check.service_id)) {
          serviceMap.set(check.service_id, check);
        }
      });

      // Fetch uptime stats
      const { data: uptimeStats, error: statsError } = await supabase
        .from("health_check_stats")
        .select("*");

      if (statsError) {
        console.error("Error fetching stats:", statsError);
      }

      const statsMap = new Map<string, HealthCheckStats>();
      ((uptimeStats || []) as HealthCheckStats[]).forEach(stat => {
        statsMap.set(stat.service_id, stat);
      });

      // Build services list
      const serviceDefinitions = [
        { id: "database", name: "Banco de Dados", description: "Armazenamento principal de dados" },
        { id: "auth", name: "Autenticação", description: "Sistema de login e autenticação" },
        { id: "edge-functions", name: "Funções de Backend", description: "Processamento de imagens e lógica" },
        { id: "realtime", name: "Tempo Real", description: "Atualizações em tempo real" },
        { id: "openai", name: "API IA", description: "Geração de imagens via IA" },
        { id: "cdn", name: "CDN / Assets", description: "Entrega de arquivos estáticos" },
      ];

      const builtServices: ServiceHealth[] = serviceDefinitions.map(def => {
        const latest = serviceMap.get(def.id);
        const stats = statsMap.get(def.id);
        
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          status: latest ? (latest.status as ServiceStatus) : "unknown",
          responseTime: latest?.response_time_ms || undefined,
          lastChecked: latest ? new Date(latest.created_at) : null,
          icon: serviceIcons[def.id] || <Server className="h-5 w-5" />,
          uptime: stats?.uptime_percentage || 0,
          error: latest?.error_message || undefined,
        };
      });

      setServices(builtServices);
      
      if (builtServices.length > 0 && builtServices[0].lastChecked) {
        setLastFullCheck(builtServices[0].lastChecked);
      }

      // Calculate overall status
      const statuses = builtServices.map(s => s.status);
      if (statuses.every(s => s === "operational")) {
        setOverallStatus("operational");
      } else if (statuses.some(s => s === "major_outage")) {
        setOverallStatus("major_outage");
      } else if (statuses.some(s => s === "partial_outage")) {
        setOverallStatus("partial_outage");
      } else if (statuses.some(s => s === "unknown")) {
        setOverallStatus("unknown");
      } else {
        setOverallStatus("degraded");
      }

      // Fetch 90-day history for uptime bars
      const ninetyDaysAgo = subDays(new Date(), 90);
      const { data: historyData, error: historyError } = await supabase
        .from("health_checks")
        .select("service_id, status, created_at")
        .gte("created_at", ninetyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (historyError) {
        console.error("Error fetching history:", historyError);
      }

      // Group history by service and day
      const historyMap: Record<string, DayStatus[]> = {};
      
      serviceDefinitions.forEach(def => {
        const days: DayStatus[] = [];
        for (let i = 89; i >= 0; i--) {
          const date = startOfDay(subDays(new Date(), i));
          days.push({
            date,
            status: "unknown",
            checks: 0,
            operational: 0,
          });
        }
        historyMap[def.id] = days;
      });

      (historyData as HealthCheck[] || []).forEach(check => {
        const checkDate = startOfDay(new Date(check.created_at));
        const serviceHistory = historyMap[check.service_id];
        
        if (serviceHistory) {
          const dayIndex = serviceHistory.findIndex(d => 
            d.date.getTime() === checkDate.getTime()
          );
          
          if (dayIndex !== -1) {
            serviceHistory[dayIndex].checks++;
            if (check.status === "operational") {
              serviceHistory[dayIndex].operational++;
            }
          }
        }
      });

      // Calculate day status based on checks
      Object.keys(historyMap).forEach(serviceId => {
        historyMap[serviceId].forEach(day => {
          if (day.checks === 0) {
            day.status = "unknown";
          } else {
            const ratio = day.operational / day.checks;
            if (ratio >= 0.95) {
              day.status = "operational";
            } else if (ratio >= 0.8) {
              day.status = "degraded";
            } else if (ratio >= 0.5) {
              day.status = "partial_outage";
            } else {
              day.status = "major_outage";
            }
          }
        });
      });

      setUptimeHistory(historyMap);

      // Fetch active incidents from system_alerts
      const { data: alerts, error: alertsError } = await supabase
        .from("system_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (alertsError) {
        console.error("Error fetching alerts:", alertsError);
      }

      const incidentsList: Incident[] = (alerts || []).map(alert => ({
        id: alert.id,
        title: getIncidentTitle(alert.type),
        status: "investigating" as const,
        severity: alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "major" : "minor",
        createdAt: new Date(alert.created_at),
        affectedServices: getAffectedServices(alert.type),
        message: alert.message,
      }));

      setIncidents(incidentsList);

    } catch (err) {
      console.error("Error fetching health data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getIncidentTitle = (type: string): string => {
    const titles: Record<string, string> = {
      error_spike: "Aumento de Erros Detectado",
      slow_processing: "Lentidão no Processamento",
      high_usage: "Alto Volume de Requisições",
      api_error: "Erro na API Externa",
    };
    return titles[type] || "Incidente Detectado";
  };

  const getAffectedServices = (type: string): string[] => {
    const services: Record<string, string[]> = {
      error_spike: ["edge-functions", "openai"],
      slow_processing: ["edge-functions", "openai"],
      high_usage: ["database", "edge-functions"],
      api_error: ["openai"],
    };
    return services[type] || ["edge-functions"];
  };

  const runHealthCheck = async () => {
    setIsRunningCheck(true);
    
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/health-check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Health check failed");
      }

      // Refresh data after health check
      await fetchHealthData();
    } catch (err) {
      console.error("Error running health check:", err);
    } finally {
      setIsRunningCheck(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealthData, 60000);
    return () => clearInterval(interval);
  }, [fetchHealthData]);

  const clearHistoricalData = async () => {
    if (!confirm("Tem certeza que deseja limpar todo o histórico de health checks? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    setIsClearingHistory(true);
    
    try {
      const { error } = await supabase
        .from("health_checks")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records
      
      if (error) throw error;
      
      toast.success("Histórico limpo com sucesso! Execute uma verificação para reiniciar o monitoramento.");
      await fetchHealthData();
    } catch (err) {
      console.error("Error clearing history:", err);
      toast.error("Erro ao limpar histórico. Verifique suas permissões.");
    } finally {
      setIsClearingHistory(false);
    }
  };

  const getOverallStatusMessage = () => {
    switch (overallStatus) {
      case "operational":
        return "Todos os sistemas operacionais";
      case "degraded":
        return "Alguns sistemas com lentidão";
      case "partial_outage":
        return "Interrupção parcial detectada";
      case "major_outage":
        return "Sistemas fora do ar";
      case "unknown":
        return "Aguardando primeiro health check";
      default:
        return "Verificando status...";
    }
  };

  const getStatusBarColor = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "bg-success";
      case "degraded":
        return "bg-warning";
      case "partial_outage":
        return "bg-orange-500";
      case "major_outage":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Status do Sistema</h1>
            <p className="text-muted-foreground">
              Monitoramento em tempo real de todos os serviços
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastFullCheck && (
              <span className="text-sm text-muted-foreground">
                Último check: {formatDistanceToNow(lastFullCheck, { addSuffix: true, locale: ptBR })}
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearHistoricalData}
              disabled={isClearingHistory || isLoading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isClearingHistory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="ml-2">Limpar Histórico</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runHealthCheck}
              disabled={isRunningCheck || isLoading}
            >
              {isRunningCheck ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Verificar Agora</span>
            </Button>
          </div>
        </div>

        {/* Overall Status Banner */}
        <div className={cn(
          "rounded-xl p-6 border flex items-center justify-between",
          statusConfig[overallStatus].bgColor,
          "border-border"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-full", statusConfig[overallStatus].bgColor)}>
              <Activity className={cn("h-8 w-8", statusConfig[overallStatus].color)} />
            </div>
            <div>
              <h2 className={cn("text-xl font-bold", statusConfig[overallStatus].color)}>
                {getOverallStatusMessage()}
              </h2>
              <p className="text-muted-foreground">
                {incidents.length > 0 
                  ? `${incidents.length} incidente(s) ativo(s)` 
                  : "Nenhum incidente ativo"}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-4 py-2 rounded-full font-medium",
            statusConfig[overallStatus].bgColor,
            statusConfig[overallStatus].color
          )}>
            {statusConfig[overallStatus].label}
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div 
              key={service.id}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    statusConfig[service.status].bgColor
                  )}>
                    <span className={statusConfig[service.status].color}>
                      {service.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1",
                  statusConfig[service.status].color
                )}>
                  {statusConfig[service.status].icon}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    statusConfig[service.status].bgColor,
                    statusConfig[service.status].color
                  )}>
                    {statusConfig[service.status].label}
                  </span>
                </div>
                
                {service.responseTime !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latência</span>
                    <span className={cn(
                      "font-mono",
                      service.responseTime < 300 ? "text-success" :
                      service.responseTime < 1000 ? "text-warning" : "text-destructive"
                    )}>
                      {service.responseTime}ms
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime (30d)</span>
                  <span className={cn(
                    "font-medium",
                    service.uptime >= 99 ? "text-success" :
                    service.uptime >= 95 ? "text-warning" : "text-destructive"
                  )}>
                    {service.uptime > 0 ? `${service.uptime}%` : "—"}
                  </span>
                </div>

                {service.error && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                    {service.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Incidentes Ativos
              </h2>
            </div>
            <div className="divide-y divide-border">
              {incidents.map((incident) => (
                <div key={incident.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{incident.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Iniciado {formatDistanceToNow(incident.createdAt, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        incidentStatusConfig[incident.status].bgColor,
                        incidentStatusConfig[incident.status].color
                      )}>
                        {incidentStatusConfig[incident.status].label}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium border",
                        incident.severity === "critical" ? "border-destructive text-destructive" :
                        incident.severity === "major" ? "border-warning text-warning" :
                        "border-muted-foreground text-muted-foreground"
                      )}>
                        {incident.severity === "critical" ? "Crítico" :
                         incident.severity === "major" ? "Maior" : "Menor"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    {incident.affectedServices.map((serviceId) => {
                      const service = services.find(s => s.id === serviceId);
                      return (
                        <span key={serviceId} className="px-2 py-0.5 bg-secondary rounded text-xs">
                          {service?.name || serviceId}
                        </span>
                      );
                    })}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <Clock className="inline h-4 w-4 mr-1" />
                    {incident.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uptime History */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Histórico de Uptime (90 dias)</h2>
          {Object.keys(uptimeHistory).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de histórico ainda.</p>
              <p className="text-sm">Execute um health check para começar a coletar dados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => {
                const history = uptimeHistory[service.id] || [];
                return (
                  <div key={service.id} className="flex items-center gap-4">
                    <div className="w-40 flex items-center gap-2">
                      {service.icon}
                      <span className="text-sm font-medium truncate">{service.name}</span>
                    </div>
                    <div className="flex-1 flex gap-0.5">
                      {history.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-8 flex-1 rounded-sm transition-colors cursor-pointer hover:opacity-80",
                            getStatusBarColor(day.status)
                          )}
                          title={`${format(day.date, "dd/MM/yyyy")}: ${day.checks} verificações, ${day.operational} operacionais`}
                        />
                      ))}
                    </div>
                    <div className="w-16 text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        service.uptime >= 99 ? "text-success" :
                        service.uptime >= 95 ? "text-warning" : "text-destructive"
                      )}>
                        {service.uptime > 0 ? `${service.uptime}%` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Cada barra representa um dia. Verde = operacional, Amarelo = degradado, Vermelho = interrupção, Cinza = sem dados
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
