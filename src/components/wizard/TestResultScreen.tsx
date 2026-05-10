import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Shirt } from "./ShirtSelectionScreen";
import type { Background } from "@/config/fanframe";
import { useToast } from "@/hooks/use-toast";
import { getAssetFullUrl } from "@/config/fanframe";
import { useQueueSubscription, useQueueStatusCheck } from "@/hooks/useQueueSubscription";

interface TestResultScreenProps {
  userImage: string;
  selectedShirt: Shirt;
  selectedBackground: Background;
  onTryAgain: () => void;
}

const getProgressMessage = (progress: number, queuePosition: number) => {
  if (queuePosition > 20) return { title: "Alta demanda! 🔥", subtitle: `Posição ${queuePosition} na fila` };
  if (queuePosition > 5) return { title: "Preparando seu manto...", subtitle: `Posição ${queuePosition} na fila` };
  if (progress < 15) return { title: "Preparando o tecido...", subtitle: "Separando os melhores materiais" };
  if (progress < 30) return { title: "Cortando o manto...", subtitle: "Cada detalhe conta" };
  if (progress < 50) return { title: "Costurando o manto...", subtitle: "Com amor de torcedor" };
  if (progress < 70) return { title: "Bordando o escudo...", subtitle: "Quase lá!" };
  if (progress < 85) return { title: "Ajustando o caimento...", subtitle: "Perfeito pra você" };
  if (progress < 95) return { title: "Finalizando detalhes...", subtitle: "Quase pronto!" };
  return { title: "Manto pronto!", subtitle: "Ficou épico!" };
};

export const TestResultScreen = ({
  userImage,
  selectedShirt,
  selectedBackground,
  onTryAgain,
}: TestResultScreenProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(1);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);
  const { toast } = useToast();

  const { status: queueStatus, resultImageUrl, errorMessage } = useQueueStatusCheck(queueId);

  useEffect(() => {
    if (queueStatus === "completed" && resultImageUrl && !generatedImage) {
      handleGenerationComplete(resultImageUrl);
    } else if (queueStatus === "failed" && errorMessage && !error) {
      handleGenerationFailed(errorMessage);
    }
    // The generation callbacks intentionally capture this render's queue state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueStatus, resultImageUrl, errorMessage]);

  const handleRealtimeCompleted = useCallback(async (imageUrl: string) => {
    await handleGenerationComplete(imageUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRealtimeFailed = useCallback((errorMsg: string) => {
    handleGenerationFailed(errorMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePositionUpdate = useCallback((position: number) => {
    setQueuePosition(position);
  }, []);

  useQueueSubscription({
    queueId: queueId || "",
    onCompleted: handleRealtimeCompleted,
    onFailed: handleRealtimeFailed,
    onPositionUpdate: handlePositionUpdate,
  });

  const handleGenerationComplete = async (imageUrl: string) => {
    console.log("[TestResultScreen] Generation completed!");
    completeProgress();
    await new Promise(resolve => setTimeout(resolve, 300));
    setGeneratedImage(imageUrl);
    setIsGenerating(false);
  };

  const handleGenerationFailed = (errorMsg: string) => {
    console.error("[TestResultScreen] Generation failed:", errorMsg);
    completeProgress();
    setError(errorMsg);
    setIsGenerating(false);
    toast({
      title: "Erro na geração",
      description: errorMsg,
      variant: "destructive",
    });
  };

  const startProgressAnimation = useCallback((estimatedSeconds: number) => {
    setProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let currentProgress = 0;
    const totalUpdates = (estimatedSeconds * 1000) / 200;
    const incrementPerUpdate = 95 / totalUpdates;

    progressIntervalRef.current = setInterval(() => {
      const slowdownFactor = Math.max(0.3, 1 - (currentProgress / 120));
      currentProgress = Math.min(95, currentProgress + incrementPerUpdate * slowdownFactor);
      setProgress(Math.round(currentProgress));
      if (currentProgress >= 95 && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }, 200);
  }, []);

  const completeProgress = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
  }, []);

  const startGeneration = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setQueueId(null);

    try {
      const shirtAssetUrl = getAssetFullUrl(selectedShirt.assetPath);
      const backgroundAssetUrl = getAssetFullUrl(selectedBackground.assetPath);

      console.log("[TestResultScreen] Starting generation:", { shirtAssetUrl, backgroundAssetUrl });

      const { data, error: fnError } = await supabase.functions.invoke("generate-tryon", {
        body: {
          userImageBase64: userImage,
          shirtAssetUrl,
          backgroundAssetUrl,
          shirtId: selectedShirt.id,
          userId: "test-user",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (!data?.queueId) throw new Error("Falha ao iniciar geração");

      console.log("[TestResultScreen] Queue created:", data.queueId);
      setQueueId(data.queueId);
      setQueuePosition(data.queuePosition || 1);
      startProgressAnimation(data.estimatedWaitSeconds || 45);
    } catch (err) {
      console.error("[TestResultScreen] Error:", err);
      setError(err instanceof Error ? err.message : "Erro ao iniciar geração");
      setIsGenerating(false);
      toast({
        title: "Erro na geração",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  }, [userImage, selectedShirt, selectedBackground, startProgressAnimation, toast]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startGeneration();
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [startGeneration]);

  const handleDownload = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `teste-timao-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast({ title: "Download iniciado!" });
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const handleRetry = () => {
    setError(null);
    hasStartedRef.current = false;
    startGeneration();
  };

  if (isGenerating) {
    const { title, subtitle } = getProgressMessage(progress, queuePosition);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in w-full max-w-md">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 sm:mb-2 uppercase transition-all duration-300">{title}</h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto mb-6 sm:mb-8 transition-all duration-300">{subtitle}</p>
          <div className="px-2 sm:px-4 mb-6 sm:mb-8">
            <Progress value={progress} className="h-2 sm:h-3 mb-2" />
            <p className="text-base sm:text-lg font-bold text-white">{progress}%</p>
          </div>
          {queuePosition > 5 && (
            <div className="mb-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm">
                <span className="text-muted-foreground">Posição na fila:</span>
                <span className="font-bold text-white">{queuePosition}</span>
              </div>
            </div>
          )}
          <div className="glass-card p-3 sm:p-4 rounded-xl border-2 border-warning/50 bg-warning/20">
            <p className="text-xs sm:text-sm text-warning font-semibold">⚠️ Não atualize ou feche a página</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 sm:mb-8 rounded-2xl bg-destructive/20 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl">😢</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 uppercase">Ops, deu ruim!</h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 max-w-xs mx-auto">{error}</p>
          <div className="space-y-3">
            <Button onClick={handleRetry} size="lg" className="w-full max-w-xs btn-mobile-cta bg-white text-black hover:bg-white/90">
              <RefreshCw className="w-5 h-5 mr-2" />
              Tentar Novamente
            </Button>
            <Button onClick={onTryAgain} size="lg" variant="outline" className="w-full max-w-xs btn-mobile border-white/30 hover:bg-white/10">
              Recomeçar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col items-center px-4 pt-6 pb-4 safe-bottom overflow-hidden">
      <div className="text-center mb-3 animate-fade-in">
        <h2 className="text-xl sm:text-2xl font-black mb-0.5 uppercase tracking-tight">Ficou épico!</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">Página de teste — sem débito de créditos.</p>
      </div>

      <div className="w-full max-w-md flex-1 min-h-0 max-h-[55vh] mb-2 animate-scale-in" style={{ animationDelay: "0.2s" }}>
        <div className="glass-card p-1.5 rounded-xl h-full">
          <div className="rounded-lg overflow-hidden bg-secondary h-full">
            {generatedImage && (
              <img src={generatedImage} alt="Resultado" className="w-full h-full object-contain" />
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-2 animate-fade-in shrink-0" style={{ animationDelay: "0.3s" }}>
        <Button onClick={handleDownload} className="w-full h-10 bg-white text-black hover:bg-white/90 transition-all text-sm font-bold">
          <Download className="w-4 h-4 mr-2" />
          Baixar Foto
        </Button>
        <Button onClick={onTryAgain} variant="outline" className="w-full h-10 border-white/30 hover:bg-white/10 transition-all text-sm font-bold">
          <RefreshCw className="w-4 h-4 mr-2" />
          GERAR OUTRA IMAGEM
        </Button>
      </div>
    </div>
  );
};
