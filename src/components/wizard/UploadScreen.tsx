import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, ArrowLeft, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { useConsentLog } from "@/hooks/useConsentLog";
import heic2any from "heic2any";

// Formatos suportados pela API OpenAI
const SUPPORTED_FORMATS = ["image/jpeg", "image/png", "image/webp"];
// Formatos HEIC do iPhone que serão convertidos
const HEIC_FORMATS = ["image/heic", "image/heif"];
const SUPPORTED_FORMATS_TEXT = "JPG, PNG, WEBP ou HEIC";

interface UploadScreenProps {
  uploadedImage: string | null;
  onImageUpload: (base64: string) => void;
  onClearImage: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export const UploadScreen = ({
  uploadedImage,
  onImageUpload,
  onClearImage,
  onContinue,
  onBack,
}: UploadScreenProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoggingConsent, setIsLoggingConsent] = useState(false);
  const { toast } = useToast();
  const { logConsent, CONSENT_TEXT } = useConsentLog();
  const { team } = useTeam();
  const t = team?.text_overrides || {};

  const convertHeicToJpeg = async (file: File): Promise<Blob> => {
    try {
      const result = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      // heic2any can return an array or a single blob
      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      console.error("Error converting HEIC:", error);
      throw new Error("Não foi possível converter a imagem HEIC");
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      
      // Check if it's HEIC (by type or extension)
      const isHeic = HEIC_FORMATS.includes(fileType) || 
                     fileName.endsWith(".heic") || 
                     fileName.endsWith(".heif");

      if (isHeic) {
        setIsConverting(true);

        try {
          const convertedBlob = await convertHeicToJpeg(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            onImageUpload(base64);
            setIsConverting(false);
          };
          reader.onerror = () => {
            setIsConverting(false);
            toast({
              title: "Erro na conversão",
              description: "Não foi possível converter a imagem. Tente exportar como JPG.",
              variant: "destructive",
            });
          };
          reader.readAsDataURL(convertedBlob);
        } catch (error) {
          setIsConverting(false);
          toast({
            title: "Erro na conversão",
            description: "Não foi possível converter a imagem HEIC. Tente exportar como JPG nas configurações do iPhone.",
            variant: "destructive",
          });
        }
        return;
      }

      // Check if it's a supported format
      if (!SUPPORTED_FORMATS.includes(fileType)) {
        const formatName = fileType.split("/")[1]?.toUpperCase() || "desconhecido";
        toast({
          title: "Formato não suportado",
          description: `O formato ${formatName} não é aceito. Use apenas ${SUPPORTED_FORMATS_TEXT}.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onImageUpload(base64);
      };
      reader.readAsDataURL(file);
    },
    [onImageUpload, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center px-4 pt-10 pb-4 safe-bottom overflow-hidden">
      {/* Header */}
      <div className="text-center mb-3 sm:mb-4 animate-fade-in shrink-0">
        <h2 className="text-xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2 uppercase tracking-tight">
          {t.upload_title || "Agora, sua foto"}
        </h2>
        <p className="text-muted-foreground text-xs sm:text-lg">
          {t.upload_subtitle || "Corpo inteiro, roupa clara"}
        </p>
      </div>

      {/* Upload Area */}
      <div className={cn(
        "w-full max-w-md mb-3 sm:mb-4 animate-fade-in",
        uploadedImage ? "flex-1 min-h-0 max-h-[35vh]" : ""
      )} style={{ animationDelay: "0.1s" }}>
        {isConverting ? (
          <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-white mb-3" />
            <p className="text-xs text-muted-foreground">Processando imagem...</p>
          </div>
        ) : uploadedImage ? (
          <div className="relative glass-card p-1.5 sm:p-2 rounded-xl h-full flex flex-col">
            <div className="relative rounded-lg overflow-hidden flex-1 min-h-0">
              <img
                src={uploadedImage}
                alt="Uploaded preview"
                className="w-full h-full object-contain"
              />
              <button
                onClick={onClearImage}
                className="absolute top-2 right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/70 backdrop-blur flex items-center justify-center hover:bg-black transition-colors touch-target"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        ) : (
          <label
            className={cn(
              "block glass-card p-6 sm:p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-white/10 touch-active",
              isDragging && "border-white bg-white/10"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handleInputChange}
            />
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                {isDragging ? (
                  <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                ) : (
                  <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                )}
              </div>
              <p className="text-base sm:text-lg font-semibold mb-1">
                {isDragging ? "SOLTA AÍ!" : "ESCOLHER FOTO"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {SUPPORTED_FORMATS_TEXT} • Corpo inteiro
              </p>
            </div>
          </label>
        )}
      </div>

      {/* Consent Checkbox - Only show when image is uploaded */}
      {uploadedImage && !isConverting && (
        <div className="w-full max-w-md mb-3 animate-fade-in shrink-0" style={{ animationDelay: "0.2s" }}>
          <div className="glass-card p-3 sm:p-4 rounded-xl">
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={hasConsented}
                onCheckedChange={async (checked) => {
                  if (checked) {
                    setIsLoggingConsent(true);
                    const userId = `anonymous_${Date.now()}`;
                    await logConsent(userId);
                    setIsLoggingConsent(false);
                  }
                  setHasConsented(checked === true);
                }}
                disabled={isLoggingConsent}
                className="mt-0.5 h-4 w-4 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
              <label
                htmlFor="consent"
                className="text-[10px] sm:text-xs text-muted-foreground leading-snug cursor-pointer"
              >
                Declaro que sou o titular da imagem, que não contém conteúdo ilegal ou impróprio, e concordo com o{" "}
                <a
                  href="/termos-de-uso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline hover:text-white/80 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Termo de Uso
                </a>
                .
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tips - only without image */}
      {!uploadedImage && !isConverting && (
        <div className="w-full max-w-md mb-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="glass-card p-4 sm:p-5 rounded-xl">
            <h4 className="font-bold text-xs sm:text-sm uppercase mb-2 sm:mb-3">Dicas para melhor resultado</h4>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li>• Foto de corpo inteiro, de frente</li>
              <li>• Roupa clara funciona melhor</li>
              <li>• Boa iluminação ajuda demais</li>
            </ul>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-2 w-full max-w-md shrink-0 animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <Button
          onClick={onBack}
          size="lg"
          variant="outline"
          disabled={isConverting || isLoggingConsent}
          className="border-white/30 hover:bg-white/10 transition-all flex-shrink-0 h-12 px-5 text-base"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          VOLTAR
        </Button>
        <Button
          onClick={onContinue}
          disabled={!uploadedImage || isConverting || !hasConsented || isLoggingConsent}
          size="lg"
          className="flex-1 transition-all duration-300 hover:scale-105 hover:opacity-90 disabled:opacity-50 disabled:hover:scale-100 h-12 text-base font-bold"
          style={{ backgroundColor: team?.primary_color || '#FFFFFF', color: team?.secondary_color || '#000000' }}
        >
          {isLoggingConsent ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              PROCESSANDO...
            </>
          ) : (
            t.upload_cta || "VESTIR O MANTO"
          )}
        </Button>
      </div>
    </div>
  );
};
