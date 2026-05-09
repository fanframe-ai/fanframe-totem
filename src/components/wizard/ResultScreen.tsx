import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeamShirt } from "@/contexts/TeamContext";
import type { TeamBackground } from "@/contexts/TeamContext";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { getAssetFullUrl } from "@/config/fanframe";
import { useQueueSubscription, useQueueStatusCheck } from "@/hooks/useQueueSubscription";

interface ResultScreenProps {
  userImage: string;
  selectedShirt: TeamShirt;
  selectedBackground: TeamBackground;
  balance: number;
  onTryAgain: () => void;
  onNoCredits: () => void;
  onHistory?: () => void;
  onTestDebit?: () => Promise<boolean>;
}

// Progress messages based on queue position
const getProgressMessage = (progress: number, queuePosition: number, teamName: string) => {
  if (queuePosition > 20) {
    return { 
      title: "Alta demanda! 🔥", 
      subtitle: `Posição ${queuePosition} na fila` 
    };
  }
  if (queuePosition > 5) {
    return { 
      title: "Preparando seu manto...", 
      subtitle: `Posição ${queuePosition} na fila` 
    };
  }
  
  // Regular progress messages
  if (progress < 15) return { title: "Preparando o tecido...", subtitle: "Separando os melhores materiais" };
  if (progress < 30) return { title: "Cortando o manto...", subtitle: "Cada detalhe conta" };
  if (progress < 50) return { title: "Costurando o manto...", subtitle: "Com amor de torcedor" };
  if (progress < 70) return { title: "Bordando o escudo...", subtitle: `O símbolo do ${teamName}` };
  if (progress < 85) return { title: "Ajustando o caimento...", subtitle: "Perfeito pra você" };
  if (progress < 95) return { title: "Finalizando detalhes...", subtitle: "Quase pronto!" };
  return { title: "Manto pronto!", subtitle: `Vai ${teamName}!` };
};

export const ResultScreen = ({
  userImage,
  selectedShirt,
  selectedBackground,
  balance,
  onTryAgain,
  onNoCredits,
  onHistory,
  onTestDebit,
}: ResultScreenProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(1);
  
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);
  const hasDebitedRef = useRef(false);
  const { toast } = useToast();
  const { team } = useTeam();

  // Check queue status on mount (in case we missed realtime update)
  const { status: queueStatus, resultImageUrl, errorMessage } = useQueueStatusCheck(queueId);

  // Handle queue completion from status check
  useEffect(() => {
    if (queueStatus === "completed" && resultImageUrl && !generatedImage) {
      handleGenerationComplete(resultImageUrl);
    } else if (queueStatus === "failed" && errorMessage && !error) {
      handleGenerationFailed(errorMessage);
    }
  }, [queueStatus, resultImageUrl, errorMessage]);

  // Subscribe to queue updates via Realtime
  const handleRealtimeCompleted = useCallback(async (imageUrl: string) => {
    await handleGenerationComplete(imageUrl);
  }, []);

  const handleRealtimeFailed = useCallback((errorMsg: string) => {
    handleGenerationFailed(errorMsg);
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
    console.log("[ResultScreen] Generation completed via queue!");
    
    // Guard against double debit (polling + realtime can both fire)
    if (hasDebitedRef.current) {
      console.log("[ResultScreen] Debit already done, skipping duplicate");
      completeProgress();
      await new Promise(resolve => setTimeout(resolve, 300));
      setGeneratedImage(imageUrl);
      setIsGenerating(false);
      return;
    }
    hasDebitedRef.current = true;
    
    // Debit only happens in test mode (test_links). Admin preview & open access skip debit.
    if (onTestDebit) {
      const success = await onTestDebit();
      if (!success) {
        console.warn("[ResultScreen] Test debit falhou");
      }
    }

    completeProgress();
    
    // Small delay to show 100% before displaying image
    await new Promise(resolve => setTimeout(resolve, 300));
    setGeneratedImage(imageUrl);
    setIsGenerating(false);
  };

  const handleGenerationFailed = (errorMsg: string) => {
    console.error("[ResultScreen] Generation failed:", errorMsg);
    completeProgress();
    setError(errorMsg);
    setIsGenerating(false);
    
    toast({
      title: "Erro na geração",
      description: "Seu crédito não foi consumido. Tente novamente.",
      variant: "destructive",
    });
  };

  const startProgressAnimation = useCallback((estimatedSeconds: number) => {
    setProgress(0);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    let currentProgress = 0;
    const totalUpdates = (estimatedSeconds * 1000) / 200; // updates every 200ms
    const incrementPerUpdate = 95 / totalUpdates;
    
    progressIntervalRef.current = setInterval(() => {
      // Slow down as we approach 95%
      const slowdownFactor = Math.max(0.3, 1 - (currentProgress / 120));
      currentProgress = Math.min(95, currentProgress + incrementPerUpdate * slowdownFactor);
      setProgress(Math.round(currentProgress));
      
      if (currentProgress >= 95) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
    }, 200);
  }, []);

  const completeProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setProgress(100);
  }, []);

  const startGeneration = useCallback(async () => {
    // Check balance first
    if (balance <= 0) {
      console.log("[ResultScreen] No credits - redirecting to purchase");
      onNoCredits();
      return;
    }

    setIsGenerating(true);
    setError(null);
    setQueueId(null);

    try {
      // Build full URLs for assets
      const shirtAssetUrl = getAssetFullUrl(selectedShirt.assetPath);
      const backgroundAssetUrl = getAssetFullUrl(selectedBackground.assetPath);

      console.log("[ResultScreen] Starting async generation:", {
        shirtAssetUrl,
        backgroundAssetUrl,
        userImageLength: userImage.length,
      });

      const { data, error: fnError } = await supabase.functions.invoke("generate-tryon", {
        body: {
          userImageBase64: userImage,
          shirtAssetUrl,
          backgroundAssetUrl,
          shirtId: selectedShirt.id,
          userId: null,
          team_slug: team?.slug,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.queueId) {
        throw new Error("Falha ao iniciar geração");
      }

      // Set queue ID to start listening for updates
      console.log("[ResultScreen] Queue entry created:", {
        queueId: data.queueId,
        position: data.queuePosition,
        estimatedWait: data.estimatedWaitSeconds,
      });

      setQueueId(data.queueId);
      setQueuePosition(data.queuePosition || 1);
      
      // Start progress animation based on estimated wait
      const estimatedSeconds = data.estimatedWaitSeconds || 45;
      startProgressAnimation(estimatedSeconds);

    } catch (err) {
      console.error("[ResultScreen] Error starting generation:", err);
      setError(err instanceof Error ? err.message : "Erro ao iniciar geração");
      setIsGenerating(false);
      
      toast({
        title: "Erro na geração",
        description: "Seu crédito não foi consumido. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [
    balance,
    userImage, 
    selectedShirt,
    selectedBackground,
    startProgressAnimation,
    onNoCredits,
    toast
  ]);

  // Start generation on mount
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startGeneration();
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [startGeneration]);

  const fetchImageAsBlob = async (imageUrl: string): Promise<Blob> => {
    const response = await fetch(imageUrl);
    return await response.blob();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const applyWatermark = async (imageBase64: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const mainImage = new Image();
      const watermark = new Image();
      
      mainImage.crossOrigin = "anonymous";
      watermark.crossOrigin = "anonymous";
      
      const timeout = setTimeout(() => {
        reject(new Error("Timeout loading images"));
      }, 10000);
      
      const loadImage = (img: HTMLImageElement, src: string): Promise<void> => {
        return new Promise((res, rej) => {
          img.onload = () => res();
          img.onerror = (e) => rej(new Error(`Failed to load: ${src.substring(0, 50)}`));
          img.src = src;
        });
      };
      
      Promise.all([
        loadImage(mainImage, imageBase64),
        loadImage(watermark, team?.watermark_url || "/watermark.webp")
      ])
        .then(() => {
          clearTimeout(timeout);
          
          const canvas = document.createElement("canvas");
          canvas.width = mainImage.width;
          canvas.height = mainImage.height;
          const ctx = canvas.getContext("2d");
          
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          
          ctx.drawImage(mainImage, 0, 0);
          
          const watermarkWidth = Math.max(150, mainImage.width * 0.15);
          const watermarkHeight = (watermark.height / watermark.width) * watermarkWidth;
          
          const x = mainImage.width - watermarkWidth - 15;
          const y = mainImage.height - watermarkHeight - 15;
          
          ctx.globalAlpha = 0.85;
          ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
          ctx.globalAlpha = 1.0;
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to convert canvas to blob"));
          }, "image/png");
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    const teamSlug = team?.slug || "provador";
    const filename = `${teamSlug}-${Date.now()}.png`;

    try {
      // If no watermark configured, download directly without watermark
      if (!team?.watermark_url) {
        console.log("No watermark configured, downloading directly...");
        const blob = await fetchImageAsBlob(generatedImage);
        downloadBlob(blob, filename);
        toast({
          title: "Download iniciado!",
          description: "Sua foto está sendo baixada",
        });
        return;
      }

      console.log("Starting download with watermark...");
      
      const isUrl = generatedImage.startsWith("http");
      let imageToProcess = generatedImage;
      
      if (isUrl) {
        console.log("Converting URL to base64 for watermark...");
        const blob = await fetchImageAsBlob(generatedImage);
        imageToProcess = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      
      const watermarkedBlob = await applyWatermark(imageToProcess);
      downloadBlob(watermarkedBlob, filename);

      toast({
        title: "Download iniciado!",
        description: "Sua foto com marca d'água está sendo baixada",
      });
    } catch (error) {
      console.error("Error applying watermark:", error);
      
      toast({
        title: "Erro ao aplicar marca d'água",
        description: "Baixando imagem sem marca d'água...",
        variant: "destructive",
      });
      
      // Fallback: download without watermark using blob
      try {
        const blob = await fetchImageAsBlob(generatedImage);
        downloadBlob(blob, filename);
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError);
        toast({
          title: "Erro no download",
          description: "Não foi possível baixar a imagem.",
          variant: "destructive",
        });
      }
    }
  };


  const handleRetry = () => {
    setError(null);
    hasStartedRef.current = false;
    startGeneration();
  };

  // Loading state
  if (isGenerating) {
    const { title, subtitle } = getProgressMessage(progress, queuePosition, team?.name || "Time");
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in w-full max-w-md">
          {/* Spinner */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 sm:mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
          </div>
          
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 sm:mb-2 uppercase transition-all duration-300">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto mb-6 sm:mb-8 transition-all duration-300">
            {subtitle}
          </p>
          
          {/* Progress Bar */}
          <div className="px-2 sm:px-4 mb-6 sm:mb-8">
            <Progress value={progress} className="h-2 sm:h-3 mb-2" />
            <p className="text-base sm:text-lg font-bold text-white">{progress}%</p>
          </div>

          {/* Queue position indicator (only show if > 5) */}
          {queuePosition > 5 && (
            <div className="mb-4 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm">
                <span className="text-muted-foreground">Posição na fila:</span>
                <span className="font-bold text-white">{queuePosition}</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="glass-card p-3 sm:p-4 rounded-xl border-2 border-warning/50 bg-warning/20">
            <p className="text-xs sm:text-sm text-warning font-semibold">
              ⚠️ Não atualize ou feche a página
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 safe-bottom">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 sm:mb-8 rounded-2xl bg-destructive/20 flex items-center justify-center">
            <span className="text-3xl sm:text-4xl">😢</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4 uppercase">
            Ops, deu ruim!
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 max-w-xs mx-auto">
            {error}
          </p>
          <Button
            onClick={handleRetry}
            size="lg"
            className="btn-mobile-cta hover:opacity-90"
            style={{ backgroundColor: team?.primary_color || '#FFFFFF', color: team?.secondary_color || '#000000' }}
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="h-[100dvh] flex flex-col items-center px-4 pt-6 pb-4 safe-bottom overflow-hidden">
      {/* Header */}
      <div className="text-center mb-1 animate-fade-in">
        <h2 className="text-xl sm:text-2xl font-black mb-0.5 uppercase tracking-tight">
          Ficou épico!
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Você vestiu o manto do {team?.name || "time"}.
        </p>
      </div>

      {/* Credits Counter */}
      <div className="mb-1 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="px-3 py-1 rounded-full bg-white/10 text-xs">
          <span className="text-muted-foreground">Créditos: </span>
          <span className="font-bold text-white">{balance}</span>
        </div>
      </div>

      {/* Generated Image */}
      <div className="w-full max-w-md flex-1 min-h-0 max-h-[55vh] mb-2 animate-scale-in" style={{ animationDelay: "0.2s" }}>
        <div className="glass-card p-1.5 rounded-xl h-full">
          <div className="rounded-lg overflow-hidden bg-secondary h-full">
            {generatedImage && (
              <img
                src={generatedImage}
                alt={`Você com o manto do ${team?.name || "time"}`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-2 animate-fade-in shrink-0" style={{ animationDelay: "0.3s" }}>
        <Button
          onClick={handleDownload}
          className="w-full h-10 hover:opacity-90 transition-all text-sm font-bold"
          style={{ backgroundColor: team?.primary_color || '#FFFFFF', color: team?.secondary_color || '#000000' }}
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar Foto
        </Button>

        <Button
          onClick={balance > 0 ? onTryAgain : onNoCredits}
          variant="outline"
          className="w-full h-10 border-white/30 hover:bg-white/10 transition-all text-sm font-bold"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          GERAR OUTRA IMAGEM
        </Button>

        {onHistory && (
          <button
            onClick={onHistory}
            className="w-full text-center text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors py-1"
          >
            📸 Ver meu histórico de fotos
          </button>
        )}
      </div>

    </div>
  );
};
