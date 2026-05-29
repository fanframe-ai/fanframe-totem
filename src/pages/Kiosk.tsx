import { type CSSProperties, type Dispatch, type FormEvent, type RefObject, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueueSubscription } from "@/hooks/useQueueSubscription";
import { useTeam, type TeamBackground, type TeamShirt, type TeamTextOverrides, type TeamWaitingSlide } from "@/contexts/TeamContext";
import { getAssetFullUrl } from "@/config/fanframe";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import beforeExampleImage from "@/assets/before-example.jpg";
import afterExampleImage from "@/assets/after-example.png";
import {
  KioskCameraVisual,
  KioskGeneratingVisual,
  KioskHomeVisual,
  KioskPaymentVisual,
  KioskResultVisual,
  KioskSelectionVisual,
  KioskVisualShell,
} from "@/shared/kiosk-ui/KioskVisual";
import {
  buildDeliveryUrl,
  classifyKioskError,
  friendlyPaymentError,
  pollKioskCommand,
  pollKioskState,
  redeemInstallCode,
  reportKioskHealth,
  filterVisibleAssets,
  formatCurrencyFromCents,
  isSafeKioskReloadStep,
  normalizeKioskTimeout,
  shouldReportHealth,
  shouldReloadForRemoteKioskState,
  shouldResetKioskForInactivity,
  verifyTechnicalPin,
} from "@/lib/kiosk";
import type { KioskRuntimeConfig, KioskTechnicalStatus, KioskUpdateStatus, StoredDeviceIdentity } from "@/types/kiosk";

const flamengoToolkitFontFamily = '"Zalando Sans Expanded", Arial, sans-serif';

function slugifyTeamName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveTeamFontFamily(team: { name?: string | null; slug?: string | null; kiosk_font_family?: string | null }) {
  const isFlamengo = [team.slug, team.name].some((value) => slugifyTeamName(String(value || "")).includes("flamengo"));
  if (isFlamengo) return flamengoToolkitFontFamily;
  return team.kiosk_font_family || "Inter, system-ui, sans-serif";
}

type KioskStep =
  | "boot"
  | "pairing"
  | "maintenance"
  | "home"
  | "shirt"
  | "background"
  | "payment"
  | "camera"
  | "generating"
  | "result";

type PaymentMethod = "pix";
type KioskCopyKey = keyof TeamTextOverrides;

interface KioskPaymentResponse {
  sessionId: string;
  paymentId: string;
  status: string;
  amountCents: number;
  currency: string;
  referenceId?: string;
  qrCodeText?: string;
  qrCodeUrl?: string;
  expiresAt?: string;
  simulated?: boolean;
  paid?: boolean;
  error?: string;
}

async function invokeKioskPayment(body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-kiosk-payment`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(String(payload?.error || `Erro HTTP ${response.status} ao iniciar pagamento.`));
  }
  return payload;
}

type TechnicalCheck = {
  status: "idle" | "running" | "ok" | "fail";
  message: string;
};

type TechnicalChecks = {
  internet: TechnicalCheck;
  supabase: TechnicalCheck;
  camera: TechnicalCheck;
  payments: TechnicalCheck;
  diagnostics: TechnicalCheck;
};

type RailScrollState = {
  canPrev: boolean;
  canNext: boolean;
};

const browserPreviewConfig: KioskRuntimeConfig = {
  teamSlug: "",
  deviceCode: "browser-preview",
  deviceSecret: "browser-preview-secret",
  simulatePayments: true,
};

const initialTechnicalChecks: TechnicalChecks = {
  internet: { status: "idle", message: "Nao testado" },
  supabase: { status: "idle", message: "Nao testado" },
  camera: { status: "idle", message: "Nao testado" },
  payments: { status: "idle", message: "Nao testado" },
  diagnostics: { status: "idle", message: "Nao enviado" },
};

const paymentTestModeStorageKey = "fanframe:kiosk-payment-test-mode";
const cameraMirrorStorageKey = "fanframe:kiosk-camera-mirror";
const cameraOrientationStorageKey = "fanframe:kiosk-camera-orientation";
const pairingTechnicalPin = "0000";

type CameraOrientation = "normal" | "mirror" | "rotate-right" | "rotate-left" | "rotate-180" | "rotate-right-mirror" | "rotate-left-mirror";

const cameraOrientationOptions: Array<{ value: CameraOrientation; label: string; description: string }> = [
  { value: "normal", label: "Normal", description: "Camera horizontal normal." },
  { value: "mirror", label: "Espelhada", description: "Corrige camera invertida esquerda/direita." },
  { value: "rotate-right", label: "Vertical direita", description: "Gira 90 graus para a direita." },
  { value: "rotate-left", label: "Vertical esquerda", description: "Gira 90 graus para a esquerda." },
  { value: "rotate-180", label: "De cabeca para baixo", description: "Gira 180 graus." },
  { value: "rotate-right-mirror", label: "Vertical direita espelhada", description: "Gira para a direita e corrige espelho." },
  { value: "rotate-left-mirror", label: "Vertical esquerda espelhada", description: "Gira para a esquerda e corrige espelho." },
];

function normalizeCameraOrientation(value: string | null | undefined): CameraOrientation {
  if (value === "false") return "normal";
  if (value === "true") return "mirror";
  return cameraOrientationOptions.some((option) => option.value === value) ? value as CameraOrientation : "mirror";
}

function getCameraOrientationLabel(value: CameraOrientation) {
  return cameraOrientationOptions.find((option) => option.value === value)?.label || "Espelhada";
}

function isVerticalCameraOrientation(orientation: CameraOrientation) {
  return orientation === "rotate-right" || orientation === "rotate-left" || orientation === "rotate-right-mirror" || orientation === "rotate-left-mirror";
}

function getCameraPreviewTransform(orientation: CameraOrientation) {
  const transformByOrientation: Record<CameraOrientation, string> = {
    normal: "none",
    mirror: "scaleX(-1)",
    "rotate-right": "rotate(90deg)",
    "rotate-left": "rotate(-90deg)",
    "rotate-180": "rotate(180deg)",
    "rotate-right-mirror": "rotate(90deg) scaleX(-1)",
    "rotate-left-mirror": "rotate(-90deg) scaleX(-1)",
  };
  return transformByOrientation[orientation];
}

function OrientedCameraPreview({ videoRef, orientation }: { videoRef: RefObject<HTMLVideoElement>; orientation: CameraOrientation }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const isVertical = isVerticalCameraOrientation(orientation);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setFrameSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const videoStyle: CSSProperties = {
    transform: `translate(-50%, -50%) ${getCameraPreviewTransform(orientation)}`,
    width: isVertical && frameSize.height ? `${frameSize.height}px` : "100%",
    height: isVertical && frameSize.width ? `${frameSize.width}px` : "100%",
  };

  return (
    <div ref={frameRef} className={`oriented-camera-video ${isVertical ? "is-vertical" : ""}`}>
      <video ref={videoRef} style={videoStyle} playsInline muted />
    </div>
  );
}

function drawOrientedVideoFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, orientation: CameraOrientation, width: number, height: number) {
  if (orientation === "normal") {
    ctx.drawImage(video, 0, 0, width, height);
    return;
  }
  if (orientation === "mirror") {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    return;
  }
  if (orientation === "rotate-180") {
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    ctx.drawImage(video, 0, 0, width, height);
    return;
  }
  if (orientation === "rotate-right") {
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(video, 0, 0, height, width);
    return;
  }
  if (orientation === "rotate-left") {
    ctx.translate(0, height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(video, 0, 0, height, width);
    return;
  }
  if (orientation === "rotate-right-mirror") {
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.translate(height, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, height, width);
    return;
  }
  ctx.translate(0, height);
  ctx.rotate(-Math.PI / 2);
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, height, width);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeRuntimeConfig(current: KioskRuntimeConfig | null, remoteConfig: Record<string, unknown>) {
  const currentUpdates = isObjectRecord(current?.updates) ? current.updates : {};
  const remoteUpdates = isObjectRecord(remoteConfig.updates) ? remoteConfig.updates : {};
  return {
    ...(current || browserPreviewConfig),
    updates: {
      ...currentUpdates,
      ...remoteUpdates,
    },
  } as KioskRuntimeConfig;
}

function isRevokedDeviceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unknown device") ||
    normalized.includes("invalid device secret") ||
    normalized.includes("device disabled") ||
    normalized.includes("totem nao encontrado") ||
    normalized.includes("chave local do totem invalida")
  );
}

function KioskButton({
  children,
  onClick,
  onPointerUp,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const baseClassName =
    variant === "primary"
      ? "min-h-[88px] px-10 text-2xl font-black uppercase tracking-wide"
      : variant === "secondary"
        ? "min-h-[76px] px-8 text-xl font-black uppercase"
        : "min-h-[64px] px-6 text-lg font-bold uppercase";

  return (
    <Button
      type={type}
      onClick={onClick}
      onPointerUp={onPointerUp}
      disabled={disabled}
      variant={variant === "primary" ? "default" : variant === "secondary" ? "outline" : "ghost"}
      className={`${baseClassName} ${className}`}
    >
      {children}
    </Button>
  );
}

function useProgress(isActive: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }

    let value = 0;
    const interval = setInterval(() => {
      value = Math.min(95, value + Math.max(1, (100 - value) * 0.045));
      setProgress(Math.round(value));
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  return { progress, complete: () => setProgress(100) };
}

export default function KioskPage() {
  const { team, isLoading: teamLoading, error: teamError, setSlug } = useTeam();
  const [config, setConfig] = useState<KioskRuntimeConfig | null>(null);
  const [identity, setIdentity] = useState<StoredDeviceIdentity | null>(null);
  const [step, setStep] = useState<KioskStep>("boot");
  const [error, setError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [technicalUnlocked, setTechnicalUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [technicalPinError, setTechnicalPinError] = useState("");
  const [technicalStatus, setTechnicalStatus] = useState<KioskTechnicalStatus | null>(null);
  const [updateStatus, setUpdateStatus] = useState<KioskUpdateStatus | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [technicalChecks, setTechnicalChecks] = useState<TechnicalChecks>(initialTechnicalChecks);
  const [technicalCameraPreview, setTechnicalCameraPreview] = useState(false);
  const [technicalCameraOrientationOpen, setTechnicalCameraOrientationOpen] = useState(false);
  const [pendingRemoteReload, setPendingRemoteReload] = useState(false);
  const [shirtRailScroll, setShirtRailScroll] = useState<RailScrollState>({ canPrev: false, canNext: false });
  const [selectedShirt, setSelectedShirt] = useState<TeamShirt | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<TeamBackground | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [pixQrImage, setPixQrImage] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<KioskPaymentResponse | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null);
  const [deliveryQrImage, setDeliveryQrImage] = useState<string | null>(null);
  const [waitingSlideIndex, setWaitingSlideIndex] = useState(0);
  const [cameraOrientation, setCameraOrientation] = useState<CameraOrientation>(() => {
    const storedOrientation = localStorage.getItem(cameraOrientationStorageKey);
    if (storedOrientation) return normalizeCameraOrientation(storedOrientation);
    return normalizeCameraOrientation(localStorage.getItem(cameraMirrorStorageKey));
  });
  const [cameraCountdown, setCameraCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const technicalCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const technicalCameraStreamRef = useRef<MediaStream | null>(null);
  const cameraCountdownTimerRef = useRef<number | null>(null);
  const shirtRailRef = useRef<HTMLDivElement | null>(null);
  const technicalHoldTimerRef = useRef<number | null>(null);
  const generationSettledRef = useRef(false);
  const { progress, complete } = useProgress(step === "generating");

  const timeoutSeconds = normalizeKioskTimeout(team?.kiosk_timeout_seconds);
  const cameraCountdownSeconds = Math.min(10, Math.max(0, Number(team?.kiosk_camera_countdown_seconds ?? 5)));
  const visibleShirts = useMemo(() => filterVisibleAssets(team?.shirts || []), [team?.shirts]);
  const visibleBackgrounds = useMemo(() => filterVisibleAssets(team?.backgrounds || []), [team?.backgrounds]);
  const priceLabel = formatCurrencyFromCents(team?.kiosk_price_cents || 0, team?.kiosk_currency || "BRL");
  const copy = useCallback((key: KioskCopyKey, fallback: string, legacyKey?: KioskCopyKey) => {
    const text = team?.text_overrides || {};
    return text[key] || (legacyKey ? text[legacyKey] : undefined) || fallback;
  }, [team?.text_overrides]);
  const activeDevice = useMemo(() => ({
    deviceCode: identity?.deviceCode || config?.deviceCode || "",
    deviceSecret: identity?.deviceSecret || config?.deviceSecret || "",
  }), [config?.deviceCode, config?.deviceSecret, identity?.deviceCode, identity?.deviceSecret]);
  const hasDeviceAuth = Boolean(activeDevice.deviceCode && activeDevice.deviceSecret);

  useEffect(() => {
    setSelectedBackground(visibleBackgrounds[0] || null);
  }, [visibleBackgrounds]);
  const tutorialAssets = team?.tutorial_assets || {};
  const homeBeforeImage = tutorialAssets.before || beforeExampleImage;
  const homeAfterImage = tutorialAssets.after || afterExampleImage;
  const waitingSlides = useMemo<TeamWaitingSlide[]>(() => {
    const configuredSlides = tutorialAssets.waitingSlides || [];
    if (configuredSlides.length > 0) return configuredSlides;
    return [
      {
        id: "team",
        title: team?.name ? `Voce esta com ${team.name}` : "Sua foto esta ficando pronta",
        subtitle: "Estamos preparando a imagem final com a identidade do time.",
        imageUrl: team?.logo_url || "",
      },
      {
        id: "shirt",
        title: selectedShirt?.name || "Camisa escolhida",
        subtitle: selectedShirt?.subtitle || "A IA esta ajustando a camisa na sua foto.",
        imageUrl: selectedShirt?.imageUrl || "",
      },
    ].filter((slide) => slide.title || slide.subtitle || slide.imageUrl);
  }, [selectedShirt, team?.logo_url, team?.name, tutorialAssets.waitingSlides]);
  const currentWaitingSlide = waitingSlides[waitingSlideIndex % Math.max(1, waitingSlides.length)];
  const progressLabel = progress >= 95 ? "Quase pronto" : `${progress}%`;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopTechnicalCameraPreview = useCallback(() => {
    technicalCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    technicalCameraStreamRef.current = null;
    if (technicalCameraVideoRef.current) technicalCameraVideoRef.current.srcObject = null;
    setTechnicalCameraPreview(false);
  }, []);

  const closeTechnicalCameraOrientation = useCallback(() => {
    stopTechnicalCameraPreview();
    setTechnicalCameraOrientationOpen(false);
  }, [stopTechnicalCameraPreview]);

  const stopCameraCountdown = useCallback(() => {
    if (cameraCountdownTimerRef.current) {
      window.clearInterval(cameraCountdownTimerRef.current);
      cameraCountdownTimerRef.current = null;
    }
    setCameraCountdown(null);
  }, []);

  const clearLocalPairing = useCallback(async (message?: string) => {
    stopCameraCountdown();
    stopCamera();
    closeTechnicalCameraOrientation();
    await window.fanframeKiosk?.clearDeviceIdentity?.().catch(() => undefined);
    localStorage.removeItem("fanframe:kiosk-team");
    setIdentity(null);
    setConfig((current) => current ? { ...current, teamSlug: "", deviceSecret: "", deviceCode: "" } : current);
    setSlug("");
    setSelectedShirt(null);
    setSelectedBackground(null);
    setPaymentMethod(null);
    setSessionId(null);
    setPaymentId(null);
    setPixQrImage(null);
    setPixPayment(null);
    setUserImage(null);
    setQueueId(null);
    setGeneratedImage(null);
    setDeliveryUrl(null);
    setDeliveryQrImage(null);
    setPairingCode("");
    setPairingError("");
    setTechnicalOpen(false);
    setTechnicalUnlocked(false);
    setPinInput("");
    setTechnicalPinError("");
    setError(message || null);
    setStep("pairing");
  }, [setSlug, stopCamera, stopCameraCountdown, closeTechnicalCameraOrientation]);

  const resetFlow = useCallback(() => {
    stopCameraCountdown();
    stopCamera();
    closeTechnicalCameraOrientation();
    setStep(team?.kiosk_enabled ? "home" : "maintenance");
    setError(null);
    setSelectedShirt(null);
    setSelectedBackground(null);
    setPaymentMethod(null);
    setSessionId(null);
    setPaymentId(null);
    setPaymentBusy(false);
    setPixQrImage(null);
    setPixPayment(null);
    setUserImage(null);
    setQueueId(null);
    generationSettledRef.current = false;
    setGeneratedImage(null);
    setDeliveryUrl(null);
    setDeliveryQrImage(null);
  }, [stopCamera, stopCameraCountdown, closeTechnicalCameraOrientation, team?.kiosk_enabled]);

  const finishResult = useCallback((event?: React.SyntheticEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    resetFlow();
    window.setTimeout(() => {
      window.location.replace("/kiosk");
    }, 50);
  }, [resetFlow]);

  useEffect(() => {
    if (step !== "generating" || waitingSlides.length <= 1) {
      setWaitingSlideIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setWaitingSlideIndex((current) => (current + 1) % waitingSlides.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [step, waitingSlides.length]);

  const applyRemoteState = useCallback(async (state: {
    device?: {
      teamSlug?: string | null;
      config?: Record<string, unknown> | null;
      configVersion?: number | null;
      supportPinHash?: string | null;
    } | null;
  } | null, commandType?: string) => {
    const remoteDevice = state?.device || null;
    const remoteTeamSlug = remoteDevice?.teamSlug || undefined;
    const remoteConfig = isObjectRecord(remoteDevice?.config) ? remoteDevice.config : null;
    const remoteConfigVersion = Number(remoteDevice?.configVersion || 0);
    const remoteSupportPinHash = remoteDevice?.supportPinHash || undefined;
    const shouldReload = commandType === "sync_config" || shouldReloadForRemoteKioskState(
      identity?.teamSlug || config?.teamSlug,
      identity?.configVersion || 0,
      remoteDevice,
    );

    if (remoteConfig) {
      await window.fanframeKiosk?.saveDeviceConfig?.(remoteConfig);
      setConfig((current) => mergeRuntimeConfig(current, remoteConfig));
    }

    if (remoteTeamSlug || remoteConfigVersion || remoteSupportPinHash) {
      const updatedIdentity = identity ? {
        ...identity,
        teamSlug: remoteTeamSlug || identity.teamSlug,
        configVersion: remoteConfigVersion || identity.configVersion || 0,
        supportPinHash: remoteSupportPinHash || identity.supportPinHash,
      } : null;
      if (updatedIdentity) {
        await window.fanframeKiosk?.saveDeviceIdentity?.(updatedIdentity);
        setIdentity(updatedIdentity);
      }
      if (remoteTeamSlug) {
        localStorage.setItem("fanframe:kiosk-team", remoteTeamSlug);
        setSlug(remoteTeamSlug);
        setConfig((current) => current ? { ...current, teamSlug: remoteTeamSlug } : current);
      }
    }

    if (shouldReload) {
      setPendingRemoteReload(true);
    }
  }, [config?.teamSlug, identity, setSlug]);

  const syncRemoteKioskState = useCallback(async (commandType?: string) => {
    if (!hasDeviceAuth) return null;
    const state = await pollKioskState(activeDevice).catch(async (err) => {
      if (isRevokedDeviceError(err)) {
        await clearLocalPairing("Este totem foi removido ou desativado no painel. Digite um novo codigo de instalacao.");
      }
      return null;
    });
    await applyRemoteState(state, commandType);
    return state;
  }, [activeDevice, applyRemoteState, clearLocalPairing, hasDeviceAuth]);

  const refreshTechnicalPinHash = useCallback(async () => {
    if (!hasDeviceAuth || !identity) return identity?.supportPinHash || null;
    const state = await pollKioskState(activeDevice).catch(async (err) => {
      if (isRevokedDeviceError(err)) {
        await clearLocalPairing("Este totem foi removido ou desativado no painel. Digite um novo codigo de instalacao.");
      }
      return null;
    });
    const supportPinHash = state?.device?.supportPinHash || null;
    if (!supportPinHash) return identity.supportPinHash || null;
    const updatedIdentity = { ...identity, supportPinHash };
    await window.fanframeKiosk?.saveDeviceIdentity?.(updatedIdentity).catch(() => undefined);
    setIdentity(updatedIdentity);
    return supportPinHash;
  }, [activeDevice, clearLocalPairing, hasDeviceAuth, identity]);

  const collectHealthPayload = useCallback(async (extra: Record<string, unknown> = {}) => {
    const status = await window.fanframeKiosk?.getTechnicalStatus?.().catch(() => null);
    const paymentStatus = await window.fanframeKiosk?.getPaymentStatus?.().catch(() => null);
    const appUpdateStatus = await window.fanframeKiosk?.getUpdateStatus?.().catch(() => null);
    const friendlyError = error ? classifyKioskError(error) : null;

    return {
      appVersion: status?.appVersion || config?.appVersion || "browser",
      online: status?.online ?? navigator.onLine,
      currentScreen: step,
      lastErrorCode: friendlyError?.code || null,
      lastErrorMessage: error,
      paymentStatus: paymentStatus || {
        ready: config?.simulatePayments === true,
        mode: config?.simulatePayments === true ? "simulated" : "not_configured",
        message: config?.simulatePayments === true ? "Pagamentos simulados ativos." : "PIX PagBank em modo producao.",
        plugpagConfigured: false,
        simulated: config?.simulatePayments === true,
      },
      appUpdateStatus,
      ...extra,
    };
  }, [config?.appVersion, config?.simulatePayments, error, step]);

  const processRemoteKioskCommand = useCallback(async (commandType?: string) => {
    const state = await syncRemoteKioskState(commandType);
    const command = state?.command || null;
    if (!command) return;

    try {
      if (command.command_type === "restart_app") {
        await pollKioskCommand(activeDevice, {
          completeCommandId: command.id,
          success: true,
          result: { handledAt: new Date().toISOString(), relaunching: true },
        });
        await window.fanframeKiosk?.relaunch?.();
        return;
      }
      if (command.command_type === "update_app") {
        if (!window.fanframeKiosk?.startAppUpdate) throw new Error("Atualizacao nao disponivel neste app.");
        const result = await window.fanframeKiosk.startAppUpdate();
        await pollKioskCommand(activeDevice, {
          completeCommandId: command.id,
          success: result.ok,
          result: { handledAt: new Date().toISOString(), update: result },
          errorMessage: result.ok ? null : result.message,
        });
        return;
      }
      if (command.command_type === "enter_maintenance") {
        setError("Totem em manutencao remota.");
        setStep("maintenance");
      }
      if (command.command_type === "exit_maintenance") {
        setError(null);
        resetFlow();
      }
      if (command.command_type === "send_diagnostics") {
        const health = await collectHealthPayload();
        await reportKioskHealth(activeDevice, {
          health,
          event: { eventType: "diagnostics_sent", severity: "info", payload: { step, paymentStatus: health.paymentStatus } },
        });
      }
      if (command.command_type === "sync_config") await applyRemoteState(state, "sync_config");
      await pollKioskCommand(activeDevice, {
        completeCommandId: command.id,
        success: true,
        result: { handledAt: new Date().toISOString() },
      });
    } catch (err) {
      await pollKioskCommand(activeDevice, {
        completeCommandId: command.id,
        success: false,
        errorMessage: err instanceof Error ? err.message : "Command failed",
      }).catch(() => undefined);
    }
  }, [activeDevice, applyRemoteState, collectHealthPayload, resetFlow, step, syncRemoteKioskState]);

  const retryBoot = useCallback(() => {
    window.location.reload();
  }, []);

  const updateRailScrollState = useCallback((rail: HTMLDivElement | null, setState: Dispatch<SetStateAction<RailScrollState>>) => {
    if (!rail) {
      setState({ canPrev: false, canNext: false });
      return;
    }

    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setState({
      canPrev: rail.scrollLeft > 8,
      canNext: rail.scrollLeft < maxScroll - 8,
    });
  }, []);

  const scrollRail = useCallback((rail: HTMLDivElement | null, direction: "prev" | "next") => {
    if (!rail) return;
    const distance = Math.round(rail.clientWidth * 0.72);
    rail.scrollBy({ left: direction === "next" ? distance : -distance, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateRailScrollState(shirtRailRef.current, setShirtRailScroll);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, updateRailScrollState, visibleShirts.length]);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const previewTeam = params.get("team_slug") || params.get("team") || "";
      const urlTeam = previewTeam || localStorage.getItem("fanframe:kiosk-team") || "";
      const runtimeConfig = window.fanframeKiosk
        ? await window.fanframeKiosk.getConfig()
        : { ...browserPreviewConfig, teamSlug: urlTeam };
      const paymentTestModeOverride = localStorage.getItem(paymentTestModeStorageKey);
      const effectiveConfig = {
        ...runtimeConfig,
        simulatePayments: paymentTestModeOverride === null ? runtimeConfig.simulatePayments === true : paymentTestModeOverride === "true",
      };
      const persistedCameraOrientation = normalizeCameraOrientation(runtimeConfig.cameraOrientation || localStorage.getItem(cameraOrientationStorageKey));
      setCameraOrientation(persistedCameraOrientation);
      localStorage.setItem(cameraOrientationStorageKey, persistedCameraOrientation);
      localStorage.setItem(cameraMirrorStorageKey, String(persistedCameraOrientation === "mirror" || persistedCameraOrientation === "rotate-right-mirror" || persistedCameraOrientation === "rotate-left-mirror"));
      const storedIdentity = await window.fanframeKiosk?.loadDeviceIdentity?.();

      setConfig(effectiveConfig);
      if (storedIdentity) {
        try {
          await pollKioskState({
            deviceCode: storedIdentity.deviceCode,
            deviceSecret: storedIdentity.deviceSecret,
          });
        } catch (err) {
          if (isRevokedDeviceError(err)) {
            await clearLocalPairing("Este totem foi removido ou desativado no painel. Digite um novo codigo de instalacao.");
            return;
          }
        }

        setIdentity(storedIdentity);
        const pairedTeam = storedIdentity.teamSlug || effectiveConfig.teamSlug;
        if (!pairedTeam) {
          setError("Totem pareado sem time vinculado. Gere um novo codigo de instalacao.");
          setStep("maintenance");
          return;
        }
        localStorage.setItem("fanframe:kiosk-team", pairedTeam);
        setSlug(pairedTeam);
        return;
      }

      setIdentity(null);

      if (!effectiveConfig.teamSlug) {
        setStep("pairing");
        return;
      }

      localStorage.setItem("fanframe:kiosk-team", effectiveConfig.teamSlug);
      setSlug(effectiveConfig.teamSlug);
    };

    init().catch((err) => {
      setError(err instanceof Error ? err.message : "Erro ao carregar configuracao do totem.");
      setStep("maintenance");
    });
  }, [clearLocalPairing, setSlug]);

  useEffect(() => {
    return window.fanframeKiosk?.onOpenTechnicalMode?.(() => {
      setTechnicalOpen(true);
      window.fanframeKiosk?.getTechnicalStatus?.().then((status) => setTechnicalStatus(status)).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (!hasDeviceAuth) return;
    let lastReportAt: number | null = null;
    const interval = window.setInterval(async () => {
      if (!shouldReportHealth(lastReportAt, 60_000)) return;
      lastReportAt = Date.now();
      const health = await collectHealthPayload();
      await reportKioskHealth(activeDevice, {
        health,
        event: { eventType: "health_reported", severity: "info", payload: { step, paymentStatus: health.paymentStatus } },
      }).catch(async (err) => {
        if (isRevokedDeviceError(err)) {
          await clearLocalPairing("Este totem foi removido ou desativado no painel. Digite um novo codigo de instalacao.");
        }
      });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [activeDevice, clearLocalPairing, collectHealthPayload, hasDeviceAuth, step]);

  useEffect(() => {
    if (!hasDeviceAuth) return;
    const channel = supabase.channel(`kiosk-device-${identity?.deviceId || activeDevice.deviceCode}`);
    channel
      .on("broadcast", { event: "admin_config_changed" }, async () => {
        await processRemoteKioskCommand("sync_config");
      })
      .on("broadcast", { event: "admin_restart_requested" }, async () => {
        await window.fanframeKiosk?.relaunch?.();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeDevice.deviceCode, hasDeviceAuth, identity?.deviceId, processRemoteKioskCommand]);

  useEffect(() => {
    if (!pendingRemoteReload || !isSafeKioskReloadStep(step)) return;
    window.location.reload();
  }, [pendingRemoteReload, step]);

  useEffect(() => {
    if (!hasDeviceAuth) return;
    const interval = window.setInterval(async () => {
      await processRemoteKioskCommand();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [hasDeviceAuth, processRemoteKioskCommand]);

  useEffect(() => {
    if (step !== "boot" || teamLoading) return;
    if (teamError) {
      setError(teamError);
      setStep("maintenance");
      return;
    }
    if (!team) return;
    if (!team.kiosk_enabled) {
      setError(teamError || "Totem indisponivel para este time.");
      setStep("maintenance");
      return;
    }
    setStep("home");
  }, [step, team, teamError, teamLoading]);

  useEffect(() => {
    if (!shouldResetKioskForInactivity(step)) return;
    const timeout = setTimeout(resetFlow, timeoutSeconds * 1000);
    return () => clearTimeout(timeout);
  }, [resetFlow, step, timeoutSeconds]);

  useEffect(() => {
    if (step !== "result") return;
    const timeout = setTimeout(resetFlow, 60000);
    return () => clearTimeout(timeout);
  }, [resetFlow, step]);

  useEffect(() => {
    if (step !== "camera" || userImage) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1440 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel abrir a camera.");
        setStep("maintenance");
      }
    };

    startCamera();
    return () => {
      stopCameraCountdown();
      stopCamera();
    };
  }, [step, stopCamera, stopCameraCountdown, userImage]);

  useEffect(() => {
    if (!pixPayment?.qrCodeText) {
      setPixQrImage(null);
      return;
    }

    QRCode.toDataURL(pixPayment.qrCodeText, { width: 360, margin: 1 })
      .then(setPixQrImage)
      .catch(() => setPixQrImage(null));
  }, [pixPayment?.qrCodeText]);

  useEffect(() => {
    if (!deliveryUrl) {
      setDeliveryQrImage(null);
      return;
    }

    QRCode.toDataURL(deliveryUrl, { width: 360, margin: 1 })
      .then(setDeliveryQrImage)
      .catch(() => setDeliveryQrImage(null));
  }, [deliveryUrl]);

  const completeGeneration = useCallback(async (imageUrl: string) => {
    if (!sessionId || !queueId) return;
    if (generationSettledRef.current) return;
    generationSettledRef.current = true;
    complete();
    setGeneratedImage(imageUrl);

    const { data, error: linkError } = await supabase.functions.invoke("create-delivery-link", {
      body: {
        session_id: sessionId,
        queue_id: queueId,
      },
    });

    if (linkError || data?.error) {
      setError(data?.error || linkError?.message || "Erro ao criar QR Code da imagem.");
      setStep("maintenance");
      return;
    }

    setDeliveryUrl(data.deliveryUrl || buildDeliveryUrl(SUPABASE_URL, data.token));
    setQueueId(null);
    setStep("result");
  }, [complete, queueId, sessionId]);

  const failGeneration = useCallback((message: string) => {
    if (generationSettledRef.current) return;
    generationSettledRef.current = true;
    setQueueId(null);
    setError(message);
    setStep("maintenance");
  }, []);

  useQueueSubscription({
    queueId: queueId || "",
    onCompleted: completeGeneration,
    onFailed: failGeneration,
  });

  useEffect(() => {
    if (paymentMethod !== "pix" || !paymentId || !pixPayment) return;
    if (pixPayment.paid) {
      setStep("camera");
      return;
    }

    const interval = setInterval(async () => {
      const data = await invokeKioskPayment({
        action: "status",
        payment_id: paymentId,
      }).catch(() => null);

      if (data?.paid) {
        clearInterval(interval);
        setStep("camera");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDevice.deviceCode, activeDevice.deviceSecret, config, paymentId, paymentMethod, pixPayment, sessionId]);

  const startSelection = () => {
    if (visibleShirts.length === 0 || visibleBackgrounds.length === 0) {
      setError("Cadastre camisas e um cenario fixo da IA no painel admin antes de usar este totem.");
      setStep("maintenance");
      return;
    }
    setSelectedShirt(visibleShirts[0]);
    setSelectedBackground(visibleBackgrounds[0]);
    if (team?.kiosk_show_shirt_step === false) {
      setStep("payment");
      return;
    }
    setStep("shirt");
  };

  const goAfterShirt = () => {
    setSelectedBackground((current) => current || visibleBackgrounds[0] || null);
    setStep("payment");
  };

  const startPayment = async (method: PaymentMethod) => {
    const backgroundForGeneration = selectedBackground || visibleBackgrounds[0] || null;
    if (!team || !config || !selectedShirt || !backgroundForGeneration || !hasDeviceAuth) return;
    setSelectedBackground(backgroundForGeneration);
    setPaymentMethod(method);
    setPaymentBusy(true);
    setError(null);

    let data: unknown;
    try {
      data = await invokeKioskPayment({
        action: "create",
        team_slug: team.slug,
        device_code: activeDevice.deviceCode,
        device_secret: activeDevice.deviceSecret,
        method,
        selected_shirt_id: selectedShirt.id,
        selected_background_id: backgroundForGeneration.id,
        simulate: config.simulatePayments && method === "pix",
      });
    } catch (paymentError) {
      setPaymentBusy(false);
      setPaymentMethod(null);
      const message = paymentError instanceof Error ? paymentError.message : "Erro ao iniciar pagamento.";
      setError(friendlyPaymentError(message));
      return;
    }

    const payment = data as KioskPaymentResponse;
    setSessionId(payment.sessionId);
    setPaymentId(payment.paymentId);

    setPixPayment(payment);
    setPaymentBusy(false);
    if (payment.paid) {
      setStep("camera");
      return;
    }
  };

  const capturePhoto = useCallback(() => {
    stopCameraCountdown();
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const videoWidth = video.videoWidth || 1080;
    const videoHeight = video.videoHeight || 1440;
    const isVerticalOrientation = isVerticalCameraOrientation(cameraOrientation);
    canvas.width = isVerticalOrientation ? videoHeight : videoWidth;
    canvas.height = isVerticalOrientation ? videoWidth : videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawOrientedVideoFrame(ctx, video, cameraOrientation, canvas.width, canvas.height);
    setUserImage(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
  }, [cameraOrientation, stopCamera, stopCameraCountdown]);

  const startCaptureCountdown = () => {
    if (cameraCountdown !== null) return;
    if (cameraCountdownSeconds <= 0) {
      capturePhoto();
      return;
    }

    let nextValue = cameraCountdownSeconds;
    setCameraCountdown(nextValue);
    cameraCountdownTimerRef.current = window.setInterval(() => {
      nextValue -= 1;
      if (nextValue <= 0) {
        stopCameraCountdown();
        capturePhoto();
        return;
      }
      setCameraCountdown(nextValue);
    }, 1000);
  };

  const retakePhoto = () => {
    stopCameraCountdown();
    setUserImage(null);
  };

  const goBackFromPayment = () => {
    setPaymentMethod(null);
    setPixPayment(null);
    setPaymentId(null);
    setSessionId(null);
    setPaymentBusy(false);
    setError(null);
    if (team?.kiosk_show_shirt_step !== false) {
      setStep("shirt");
      return;
    }
    setStep("home");
  };

  const goBackFromCamera = () => {
    stopCameraCountdown();
    setUserImage(null);
    resetFlow();
  };

  const getBackAction = () => {
    if (step === "payment") return goBackFromPayment;
    if (step === "camera") return goBackFromCamera;
    return null;
  };

  const startGeneration = async () => {
    const backgroundForGeneration = selectedBackground || visibleBackgrounds[0] || null;
    if (!team || !selectedShirt || !backgroundForGeneration || !userImage || !sessionId || !paymentId) return;
    setSelectedBackground(backgroundForGeneration);
    generationSettledRef.current = false;
    setStep("generating");
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("generate-tryon", {
      body: {
        userImageBase64: userImage,
        shirtAssetUrl: getAssetFullUrl(selectedShirt.assetPath),
        backgroundAssetUrl: getAssetFullUrl(backgroundForGeneration.assetPath),
        shirtId: selectedShirt.id,
        team_slug: team.slug,
        kiosk_session_id: sessionId,
        payment_id: paymentId,
        source: "kiosk",
      },
    });

    if (fnError || data?.error || !data?.queueId) {
      setError(data?.error || fnError?.message || "Erro ao iniciar geracao.");
      setStep("maintenance");
      return;
    }

    setQueueId(data.queueId);
  };

  const pairDevice = async (event: FormEvent) => {
    event.preventDefault();
    setPairingBusy(true);
    setPairingError("");
    try {
      const status = await window.fanframeKiosk?.getTechnicalStatus?.();
      const paired = await redeemInstallCode(pairingCode, navigator.userAgent, status?.appVersion || config?.appVersion || "browser");
      const pairedConfig = isObjectRecord(paired.device?.config) ? paired.device.config : null;
      const stored: StoredDeviceIdentity = {
        deviceId: paired.device.id,
        deviceCode: paired.device.deviceCode,
        deviceSecret: paired.deviceSecret,
        teamSlug: paired.team?.slug,
        configVersion: paired.device.configVersion || 0,
        supportPinHash: paired.device.supportPinHash || null,
        pairedAt: new Date().toISOString(),
      };
      await window.fanframeKiosk?.saveDeviceIdentity?.(stored);
      if (pairedConfig) await window.fanframeKiosk?.saveDeviceConfig?.(pairedConfig);
      setIdentity(stored);
      setConfig((current) => ({
        ...mergeRuntimeConfig(current, pairedConfig || {}),
        teamSlug: stored.teamSlug || current?.teamSlug || "",
        deviceCode: stored.deviceCode,
        deviceSecret: stored.deviceSecret,
      }));
      if (stored.teamSlug) {
        localStorage.setItem("fanframe:kiosk-team", stored.teamSlug);
        setSlug(stored.teamSlug);
        setStep("boot");
      } else {
        setPairingError("Codigo aceito, mas o time nao foi retornado. Gere um novo codigo no admin.");
      }
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "Codigo de instalacao invalido.");
    } finally {
      setPairingBusy(false);
    }
  };

  const openTechnicalMode = useCallback(async () => {
    setTechnicalOpen(true);
    const status = await window.fanframeKiosk?.getTechnicalStatus?.().catch(() => null);
    const updater = await window.fanframeKiosk?.getUpdateStatus?.().catch(() => null);
    setTechnicalStatus(status || {
      online: navigator.onLine,
      appVersion: config?.appVersion || "browser",
      deviceCode: activeDevice.deviceCode || null,
      lastSyncAt: null,
    });
    setUpdateStatus(updater);
  }, [activeDevice.deviceCode, config?.appVersion]);

  const cancelTechnicalHold = useCallback(() => {
    if (technicalHoldTimerRef.current) {
      window.clearTimeout(technicalHoldTimerRef.current);
      technicalHoldTimerRef.current = null;
    }
  }, []);

  const startTechnicalHold = useCallback(() => {
    cancelTechnicalHold();
    technicalHoldTimerRef.current = window.setTimeout(() => {
      technicalHoldTimerRef.current = null;
      void openTechnicalMode();
    }, 1800);
  }, [cancelTechnicalHold, openTechnicalMode]);

  useEffect(() => {
    const openFromKeyboard = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const code = event.code.toLowerCase();
      const isF12 = key === "f12" || code === "f12";
      const isTechnicalShortcut = (event.ctrlKey && event.shiftKey && isF12) || (event.ctrlKey && event.altKey && key === "t");
      if (!isTechnicalShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      void openTechnicalMode();
    };

    window.addEventListener("keydown", openFromKeyboard, true);
    return () => window.removeEventListener("keydown", openFromKeyboard, true);
  }, [openTechnicalMode]);

  const setTechnicalCheck = (key: keyof TechnicalChecks, patch: Partial<TechnicalCheck>) => {
    setTechnicalChecks((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const testInternet = async () => {
    setTechnicalCheck("internet", { status: "running", message: "Testando conexao..." });
    const status = await window.fanframeKiosk?.getTechnicalStatus?.().catch(() => null);
    const online = status?.online ?? navigator.onLine;
    setTechnicalStatus(status || technicalStatus);
    setTechnicalCheck("internet", {
      status: online ? "ok" : "fail",
      message: online ? "Internet disponivel para sincronizar." : "Sem internet no PC. Verifique Wi-Fi ou cabo.",
    });
  };

  const testSupabase = async () => {
    setTechnicalCheck("supabase", { status: "running", message: "Sincronizando com o painel..." });
    const startedAt = performance.now();
    const { error: pingError } = await supabase.from("teams").select("id").limit(1);
    const elapsedMs = Math.round(performance.now() - startedAt);
    setTechnicalCheck("supabase", {
      status: pingError ? "fail" : "ok",
      message: pingError ? `Painel indisponivel: ${pingError.message}` : `Painel respondeu em ${elapsedMs}ms`,
    });
  };

  const testCamera = async () => {
    setTechnicalCheck("camera", { status: "running", message: "Abrindo camera..." });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const [track] = stream.getVideoTracks();
      const label = track?.label || "Camera detectada";
      stream.getTracks().forEach((item) => item.stop());
      setTechnicalCheck("camera", { status: "ok", message: label });
    } catch (err) {
      setTechnicalCheck("camera", {
        status: "fail",
        message: err instanceof Error ? err.message : "Camera nao encontrada",
      });
    }
  };

  const startTechnicalCameraPreview = async () => {
    setTechnicalCheck("camera", { status: "running", message: "Abrindo preview da camera..." });
    try {
      stopTechnicalCameraPreview();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      technicalCameraStreamRef.current = stream;
      setTechnicalCameraPreview(true);
      window.setTimeout(() => {
        if (!technicalCameraVideoRef.current) return;
        technicalCameraVideoRef.current.srcObject = stream;
        void technicalCameraVideoRef.current.play();
      }, 0);
      const [track] = stream.getVideoTracks();
      const label = track?.label || "Camera detectada";
      setTechnicalCheck("camera", { status: "ok", message: `${label}. Ajuste a orientacao olhando o preview.` });
    } catch (err) {
      setTechnicalCheck("camera", {
        status: "fail",
        message: err instanceof Error ? err.message : "Camera nao encontrada",
      });
    }
  };

  const toggleTechnicalCameraOrientation = () => {
    const shouldOpen = !technicalCameraOrientationOpen;
    setTechnicalCameraOrientationOpen(shouldOpen);
    if (shouldOpen) {
      void startTechnicalCameraPreview();
    } else {
      stopTechnicalCameraPreview();
    }
  };

  const testPayments = async () => {
    setTechnicalCheck("payments", { status: "running", message: "Verificando configuracao local..." });
    const paymentStatus = await window.fanframeKiosk?.getPaymentStatus?.().catch(() => null);
    const simulatedFallback = config?.simulatePayments === true;
    const ready = paymentStatus?.ready === true || simulatedFallback;
    setTechnicalCheck("payments", {
      status: ready ? "ok" : "fail",
        message: paymentStatus?.message || (simulatedFallback ? "Pagamentos simulados ativos." : "PIX PagBank em modo producao."),
    });
  };

  const startAppUpdate = async () => {
    if (!window.fanframeKiosk?.startAppUpdate) {
      setUpdateMessage("Atualizacao local so funciona no app Windows instalado.");
      return;
    }

    setUpdateBusy(true);
    setUpdateMessage("Verificando instalador de atualizacao...");
    try {
      const updater = await window.fanframeKiosk.getUpdateStatus?.();
      setUpdateStatus(updater || null);
      if (updater && !updater.ready) {
        setUpdateMessage(updater.message);
        return;
      }
      const result = await window.fanframeKiosk.startAppUpdate();
      setUpdateMessage(result.intermediateStatus ? `${result.intermediateStatus.message} ${result.message}` : result.message);
    } catch (err) {
      setUpdateMessage(err instanceof Error ? err.message : "Nao foi possivel iniciar a atualizacao. Tente novamente com internet ativa.");
    } finally {
      setUpdateBusy(false);
    }
  };

  const togglePaymentTestMode = () => {
    const nextValue = config?.simulatePayments !== true;
    localStorage.setItem(paymentTestModeStorageKey, String(nextValue));
    setConfig((current) => ({
      ...(current || browserPreviewConfig),
      simulatePayments: nextValue,
    }));
    setTechnicalCheck("payments", {
      status: nextValue ? "ok" : "idle",
      message: nextValue ? "Pagamento teste ativado neste PC." : "Pagamento real reativado.",
    });
  };

  const updateCameraOrientation = async (nextValue: CameraOrientation) => {
    localStorage.setItem(cameraOrientationStorageKey, nextValue);
    localStorage.setItem(cameraMirrorStorageKey, String(nextValue === "mirror" || nextValue === "rotate-right-mirror" || nextValue === "rotate-left-mirror"));
    await (window.fanframeKiosk?.saveCameraOrientation?.(nextValue) ?? Promise.resolve()).catch(() => undefined);
    setCameraOrientation(nextValue);
    setTechnicalCheck("camera", {
      status: "ok",
      message: `Orientacao da camera: ${getCameraOrientationLabel(nextValue)}.`,
    });
  };

  const resetKioskInstallation = async () => {
    const confirmed = window.confirm("Resetar este totem? Ele vai perder o pareamento atual e voltar para a tela do codigo de instalacao.");
    if (!confirmed) return;

    await clearLocalPairing();
  };

  const runAllTechnicalTests = async () => {
    await testInternet();
    await testSupabase();
    await testCamera();
    await testPayments();
  };

  const checkText = (check: TechnicalCheck) => {
    if (check.status === "running") return `Testando - ${check.message}`;
    if (check.status === "ok") return `OK - ${check.message}`;
    if (check.status === "fail") return `Falha - ${check.message}`;
    return check.message;
  };

  const renderTechnicalOverlay = () => {
    if (!technicalOpen) return null;

    return (
      <div className="technical-overlay">
        <section className="technical-panel">
          {!technicalUnlocked ? (
            <form onSubmit={async (event) => {
              event.preventDefault();
              const isPairingTechnicalPin = step === "pairing" && pinInput.trim() === pairingTechnicalPin;
              if (!identity?.supportPinHash && !isPairingTechnicalPin) {
                setTechnicalPinError("PIN tecnico nao configurado neste totem. Peca um novo codigo de instalacao ao administrador.");
                return;
              }
              if (isPairingTechnicalPin) {
                setTechnicalUnlocked(true);
                setTechnicalPinError("");
                return;
              }
              let supportPinHash = identity?.supportPinHash;
              let isValidPin = await verifyTechnicalPin(pinInput, supportPinHash);
              if (!isValidPin) {
                supportPinHash = await refreshTechnicalPinHash();
                isValidPin = await verifyTechnicalPin(pinInput, supportPinHash);
              }
              if (isValidPin) {
                setTechnicalUnlocked(true);
                setTechnicalPinError("");
                return;
              }
              setTechnicalPinError("PIN invalido. Gere um novo PIN tecnico no painel e tente novamente.");
            }}>
              <h2>Modo tecnico</h2>
              <p>Area local limitada para testar conexao, camera, sincronizacao com o painel e atualizacao do app.</p>
              <input value={pinInput} onChange={(event) => setPinInput(event.target.value)} placeholder="PIN" type="password" />
              {technicalPinError && <p>{technicalPinError}</p>}
              <button>Entrar</button>
              <button type="button" onClick={() => {
                setTechnicalOpen(false);
                setTechnicalPinError("");
                setPinInput("");
              }}>Cancelar</button>
            </form>
          ) : (
            <div>
              <h2>Diagnostico do totem</h2>
              <dl className="technical-status">
                <div><dt>Internet</dt><dd>{technicalStatus?.online ? "Online" : "Offline"}</dd></div>
                <div><dt>Versao</dt><dd>{String(technicalStatus?.appVersion || config?.appVersion || "browser")}</dd></div>
                <div><dt>Dispositivo</dt><dd>{String(technicalStatus?.deviceCode || activeDevice.deviceCode || "nao pareado")}</dd></div>
                <div><dt>Time</dt><dd>{team?.name || identity?.teamSlug || config?.teamSlug || "-"}</dd></div>
                <div><dt>Atalhos</dt><dd>{technicalStatus?.shortcuts?.every((shortcut) => shortcut.registered) ? "Registrados" : "Verificar build"}</dd></div>
              </dl>
              <dl className="technical-status">
                <div><dt>Internet</dt><dd className={`technical-${technicalChecks.internet.status}`}>{checkText(technicalChecks.internet)}</dd></div>
                <div><dt>Painel</dt><dd className={`technical-${technicalChecks.supabase.status}`}>{checkText(technicalChecks.supabase)}</dd></div>
                <div><dt>Camera</dt><dd className={`technical-${technicalChecks.camera.status}`}>{checkText(technicalChecks.camera)}</dd></div>
                <div><dt>Pagamentos</dt><dd className={`technical-${technicalChecks.payments.status}`}>{checkText(technicalChecks.payments)}</dd></div>
                <div><dt>Diagnostico</dt><dd className={`technical-${technicalChecks.diagnostics.status}`}>{checkText(technicalChecks.diagnostics)}</dd></div>
                <div><dt>Atualizacao</dt><dd>{updateStatus?.message || "Ainda nao verificada neste PC."}</dd></div>
                <div><dt>Modo teste</dt><dd>{config?.simulatePayments ? "Pagamento teste ligado" : "Pagamento real"}</dd></div>
                <div><dt>Orientacao</dt><dd>{getCameraOrientationLabel(cameraOrientation)}</dd></div>
              </dl>
              <button onClick={toggleTechnicalCameraOrientation}>
                {technicalCameraOrientationOpen ? "Fechar orientacao da camera" : "Orientacao da camera"}
              </button>
              {technicalCameraOrientationOpen && (
                <div className="technical-camera-orientation-panel">
                  <label className="technical-select-field">
                    Escolha como a camera esta instalada
                    <select value={cameraOrientation} onChange={(event) => updateCameraOrientation(event.target.value as CameraOrientation)}>
                      {cameraOrientationOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label} - {option.description}</option>
                      ))}
                    </select>
                  </label>
                  <div className="technical-camera-preview">
                    <OrientedCameraPreview videoRef={technicalCameraVideoRef} orientation={cameraOrientation} />
                  </div>
                  <p className="technical-note">Troque a opcao ate a imagem ficar em pe e do lado certo. Essa escolha tambem vale para a foto enviada para a IA.</p>
                </div>
              )}
              <button onClick={runAllTechnicalTests}>Testar tudo</button>
              <button onClick={togglePaymentTestMode}>{config?.simulatePayments ? "Desligar pagamento teste" : "Ativar pagamento teste"}</button>
              <button onClick={startAppUpdate} disabled={updateBusy}>{updateBusy ? "Atualizando..." : "Atualizar app"}</button>
              {updateMessage && <p className="technical-note">{updateMessage}</p>}
              <button className="technical-danger" onClick={resetKioskInstallation}>Resetar instalacao</button>
              <button onClick={() => {
                closeTechnicalCameraOrientation();
                setTechnicalOpen(false);
                setTechnicalUnlocked(false);
                setPinInput("");
                setTechnicalPinError("");
              }}>Voltar ao totem</button>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderTechnicalHotspot = () => (
    <button
      type="button"
      aria-label="Abrir modo tecnico"
      className="technical-hotspot"
      onPointerDown={startTechnicalHold}
      onPointerUp={cancelTechnicalHold}
      onPointerCancel={cancelTechnicalHold}
      onPointerLeave={cancelTechnicalHold}
    />
  );

  const shellStyle = team ? ({
    "--team-primary": team.primary_color,
    "--team-secondary": team.secondary_color,
    fontFamily: resolveTeamFontFamily(team),
  } as React.CSSProperties) : undefined;
  const maintenanceError = error ? classifyKioskError(error) : null;
  const backAction = getBackAction();

  if (step === "pairing") {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-12">
        {renderTechnicalHotspot()}
        <section className="w-full max-w-2xl rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-base uppercase text-muted-foreground font-black tracking-wide mb-4">FanFrame Totem</p>
          <h1 className="text-6xl font-black uppercase leading-none mb-6">Conectar este totem</h1>
          <p className="text-2xl leading-relaxed text-muted-foreground mb-10">
            Digite o codigo de instalacao enviado pelo administrador.
          </p>
          <form onSubmit={pairDevice} className="grid gap-5">
            <input
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value)}
              placeholder="Ex: RECIFE-001"
              autoFocus
              className="h-20 rounded-md border border-border bg-background px-6 text-center text-3xl font-black uppercase"
            />
            <KioskButton type="submit" disabled={pairingBusy || !pairingCode.trim()} className="w-full">
              {pairingBusy ? "Conectando..." : "Conectar"}
            </KioskButton>
          </form>
          {pairingError && <p className="mt-8 text-destructive text-2xl font-bold leading-relaxed">{pairingError}</p>}
          <button className="mt-8 text-muted-foreground underline" onClick={openTechnicalMode}>Abrir modo tecnico</button>
        </section>
        {renderTechnicalOverlay()}
      </main>
    );
  }

  if (step === "boot" || teamLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        {renderTechnicalHotspot()}
        <Loader2 className="w-16 h-16 animate-spin text-primary" />
        {renderTechnicalOverlay()}
      </main>
    );
  }

  if (step === "maintenance") {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-12" style={shellStyle}>
        {renderTechnicalHotspot()}
        <section className="text-center max-w-2xl">
          <WifiOff className="w-24 h-24 mx-auto mb-8 text-destructive" />
          <h1 className="text-6xl font-black uppercase leading-none mb-6">Totem indisponivel</h1>
          <p className="text-3xl font-black leading-tight mb-4">
            {maintenanceError ? `${maintenanceError.code} - ${maintenanceError.title}` : "Verifique conexao, pagamentos e configuracao."}
          </p>
          <p className="text-2xl leading-relaxed text-muted-foreground mb-10">
            {maintenanceError?.action || error || "Chame o suporte se o problema continuar."}
          </p>
          <KioskButton variant="secondary" onClick={retryBoot} className="w-full">
            Tentar novamente
          </KioskButton>
          <button className="mt-8 text-muted-foreground underline" onClick={openTechnicalMode}>Abrir modo tecnico</button>
        </section>
        {renderTechnicalOverlay()}
      </main>
    );
  }

  return (
    <KioskVisualShell
      shellStyle={shellStyle}
      backgroundImage={tutorialAssets.kioskBackground}
      waitingVideo={tutorialAssets.waitingVideo}
      showWaitingVideo={step === "generating"}
      logoUrl={team?.logo_url}
      logoAlt={team?.name}
      brandLabel={copy("kiosk_brand_label", "FanFrame Totem")}
      teamName={team?.name}
      totalLabel={copy("kiosk_total_label", "Total")}
      priceLabel={priceLabel}
      backLabel={copy("kiosk_back", "Voltar")}
      onBack={backAction || undefined}
      technicalHotspot={renderTechnicalHotspot()}
      technicalOverlay={renderTechnicalOverlay()}
    >

        {step === "home" && (
          <KioskHomeVisual
            eyebrow={copy("kiosk_home_eyebrow", "Experiencia interativa")}
            title={copy("kiosk_home_title", "Vista o manto", "welcome_title")}
            subtitle={copy("kiosk_home_subtitle", "Escolha sua camisa, pague no totem e receba sua foto por QR Code.", "welcome_subtitle")}
            beforeImage={homeBeforeImage}
            afterImage={homeAfterImage}
            cta={<KioskButton onClick={startSelection} className="mx-auto w-full max-w-4xl">{copy("kiosk_home_cta", "Comecar", "welcome_cta")}</KioskButton>}
          />
        )}

        {step === "shirt" && (
          <KioskSelectionVisual
            kind="shirt"
            stepLabel={copy("kiosk_shirt_step", "Passo 1 de 2")}
            title={copy("kiosk_shirt_title", "Escolha a camisa", "shirt_title")}
            items={visibleShirts.map((shirt) => ({
              id: shirt.id,
              name: shirt.name,
              subtitle: shirt.subtitle,
              imageUrl: shirt.imageUrl,
            }))}
            selectedId={selectedShirt?.id}
            emptyLabel="Adicionar camisa"
            railRef={shirtRailRef}
            onRailScroll={() => updateRailScrollState(shirtRailRef.current, setShirtRailScroll)}
            canPrev={shirtRailScroll.canPrev}
            canNext={shirtRailScroll.canNext}
            onPrev={() => scrollRail(shirtRailRef.current, "prev")}
            onNext={() => scrollRail(shirtRailRef.current, "next")}
            onSelect={(shirt) => {
              const fullShirt = visibleShirts.find((item) => item.id === shirt.id);
              if (fullShirt) setSelectedShirt(fullShirt);
            }}
            cta={<KioskButton onClick={goAfterShirt} disabled={!selectedShirt} className="w-full">{copy("kiosk_continue", "Continuar")}</KioskButton>}
          />
        )}

        {step === "payment" && (
          <KioskPaymentVisual
            stepLabel={copy("kiosk_payment_step", "Passo 2 de 2")}
            title={copy("kiosk_payment_title", "Pagamento")}
            priceLabel={priceLabel}
            pixCta={copy("kiosk_payment_pix_cta", "Pagar com PIX")}
            pixHint={copy("kiosk_payment_pix_hint", "Aponte a camera do celular para o QR Code.")}
            waitingLabel={copy("kiosk_payment_waiting", "Aguardando pagamento")}
            qrHint={copy("kiosk_payment_qr_hint", "Aponte a camera do celular para pagar com PIX.")}
            cancelLabel={copy("kiosk_cancel", "Cancelar")}
            status={paymentBusy ? "busy" : paymentMethod === "pix" && pixPayment ? "qr" : "choose"}
            qrImage={pixQrImage}
            error={error}
            onStartPix={() => startPayment("pix")}
            onCancel={resetFlow}
          />
        )}

        {step === "camera" && (
          <KioskCameraVisual
            title={copy("kiosk_camera_title", "Sua foto")}
            hasPhoto={Boolean(userImage)}
            countdown={cameraCountdown}
            captureLabel={copy("kiosk_camera_capture", "Capturar")}
            retakeLabel={copy("kiosk_camera_retake", "Refazer")}
            usePhotoLabel={copy("kiosk_camera_use", "Usar foto")}
            onCapture={startCaptureCountdown}
            onRetake={retakePhoto}
            onUsePhoto={startGeneration}
            media={userImage ? (
              <img src={userImage} alt="Foto capturada" />
            ) : (
              <OrientedCameraPreview videoRef={videoRef} orientation={cameraOrientation} />
            )}
          />
        )}

        {step === "generating" && (
          <KioskGeneratingVisual
            teamName={team?.name}
            slideImage={currentWaitingSlide?.imageUrl}
            logoUrl={team?.logo_url}
            slideTitle={currentWaitingSlide?.title}
            slideSubtitle={currentWaitingSlide?.subtitle}
            title={copy("kiosk_generating_title", "Gerando imagem")}
            subtitle={copy("kiosk_generating_subtitle", "Nao feche nem desligue o totem.")}
            progress={progress}
            progressLabel={progressLabel}
            hasWaitingVideo={Boolean(tutorialAssets.waitingVideo)}
          />
        )}

        {step === "result" && (
          <KioskResultVisual
            title={copy("kiosk_result_title", "Imagem pronta")}
            image={generatedImage}
            qrImage={deliveryQrImage}
            hint={copy("kiosk_result_hint", "Escaneie para baixar no celular")}
            finishLabel={copy("kiosk_result_finish", "Finalizar")}
            onFinish={finishResult}
          />
        )}
    </KioskVisualShell>
  );
}
