import { useState, useCallback } from "react";
import { WelcomeScreen } from "@/components/wizard/WelcomeScreen";
import { TutorialScreen } from "@/components/wizard/TutorialScreen";
import { ShirtSelectionScreen } from "@/components/wizard/ShirtSelectionScreen";
import { BackgroundSelectionScreen } from "@/components/wizard/BackgroundSelectionScreen";
import { UploadScreen } from "@/components/wizard/UploadScreen";
import { ResultScreen } from "@/components/wizard/ResultScreen";
import { HistoryScreen } from "@/components/wizard/HistoryScreen";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { useTestToken } from "@/hooks/useTestToken";
import { useTeam, type TeamShirt, type TeamBackground } from "@/contexts/TeamContext";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type WizardStep = "welcome" | "tutorial" | "shirt" | "background" | "upload" | "result" | "history";

const STEP_ORDER: WizardStep[] = ["welcome", "tutorial", "shirt", "background", "upload", "result"];
const STEP_LABELS = ["Início", "Tutorial", "Manto", "Cenário", "Foto", "Resultado"];

const Index = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");
  const [selectedShirt, setSelectedShirt] = useState<TeamShirt | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<TeamBackground | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const { team, isLoading: teamLoading } = useTeam();

  const {
    isTestMode,
    testBalance,
    isLoading: testTokenLoading,
    debitTestCredit,
    refreshTestBalance,
  } = useTestToken();

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const handleShirtSelect = useCallback((shirt: TeamShirt) => {
    setSelectedShirt(shirt);
  }, []);

  const handleBackgroundSelect = useCallback((background: TeamBackground) => {
    setSelectedBackground(background);
  }, []);

  const handleImageUpload = useCallback((base64: string) => {
    setUploadedImage(base64);
  }, []);

  const handleClearImage = useCallback(() => {
    setUploadedImage(null);
  }, []);

  const handleTryAgain = useCallback(() => {
    setSelectedShirt(null);
    setSelectedBackground(null);
    goToStep("shirt");
  }, [goToStep]);

  const handleNoCredits = useCallback(() => {
    toast({
      title: "Sem créditos disponíveis",
      description: "Solicite um link de acesso para o seu time.",
      variant: "destructive",
    });
    goToStep("welcome");
  }, [goToStep]);

  // Check if running inside admin preview
  const isAdminPreview = new URLSearchParams(window.location.search).get("preview") === "admin";

  // Loading state
  if (teamLoading || testTokenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const effectiveBalance = isAdminPreview ? 999 : isTestMode ? testBalance : 0;
  const hasCredits = effectiveBalance > 0;
  const currentStepNumber = STEP_ORDER.indexOf(currentStep) + 1;
  const showStepIndicator = currentStep !== "welcome" && currentStep !== "result" && currentStep !== "history";

  // Apply team colors as CSS custom properties
  const teamColorStyles = team ? {
    '--team-primary': team.primary_color,
    '--team-secondary': team.secondary_color,
  } as React.CSSProperties : {};

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={teamColorStyles}>
      {/* Credits Display */}
      {isTestMode && !isAdminPreview && (
        <div className="fixed top-14 right-2 sm:top-16 sm:right-4 z-50 safe-right">
          <CreditsDisplay 
            balance={effectiveBalance} 
            isLoading={false}
            onRefresh={refreshTestBalance}
          />
        </div>
      )}

      {showStepIndicator && (
        <StepIndicator 
          currentStep={currentStepNumber} 
          totalSteps={STEP_ORDER.length} 
          labels={STEP_LABELS}
        />
      )}
      
      {currentStep === "welcome" && (
        <WelcomeScreen 
          onStart={async () => {
            if (isTestMode) {
              await refreshTestBalance();
              if (testBalance <= 0) {
                handleNoCredits();
                return;
              }
            }
            goToStep("tutorial");
          }}
          onHistory={() => goToStep("history")}
        />
      )}

      {currentStep === "tutorial" && (
        <TutorialScreen 
          onContinue={() => goToStep("shirt")} 
          onBack={() => goToStep("welcome")}
        />
      )}

      {currentStep === "shirt" && (
        <ShirtSelectionScreen
          selectedShirt={selectedShirt}
          onSelectShirt={handleShirtSelect}
          onContinue={() => goToStep("background")}
          onBack={() => goToStep("tutorial")}
        />
      )}

      {currentStep === "background" && (
        <BackgroundSelectionScreen
          selectedBackground={selectedBackground}
          onSelectBackground={handleBackgroundSelect}
          onContinue={() => {
            if (!hasCredits) {
              handleNoCredits();
              return;
            }
            goToStep("upload");
          }}
          onBack={() => goToStep("shirt")}
        />
      )}

      {currentStep === "upload" && (
        <UploadScreen
          uploadedImage={uploadedImage}
          onImageUpload={handleImageUpload}
          onClearImage={handleClearImage}
          onContinue={async () => {
            if (isTestMode) {
              await refreshTestBalance();
              if (testBalance <= 0) {
                handleNoCredits();
                return;
              }
            } else if (!isAdminPreview) {
              handleNoCredits();
              return;
            }
            goToStep("result");
          }}
          onBack={() => goToStep("background")}
        />
      )}

      {currentStep === "result" && selectedShirt && selectedBackground && uploadedImage && (
        <ResultScreen
          userImage={uploadedImage}
          selectedShirt={selectedShirt}
          selectedBackground={selectedBackground}
          balance={effectiveBalance}
          onTryAgain={handleTryAgain}
          onNoCredits={handleNoCredits}
          onHistory={() => goToStep("history")}
          onTestDebit={isTestMode ? async () => {
            const success = await debitTestCredit();
            if (success) {
              await refreshTestBalance();
            }
            return success;
          } : undefined}
        />
      )}

      {currentStep === "history" && (
        <HistoryScreen onBack={() => goToStep("welcome")} />
      )}
    </div>
  );
};

export default Index;
