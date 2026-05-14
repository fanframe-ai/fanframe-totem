import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, QrCode, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueueSubscription } from "@/hooks/useQueueSubscription";
import { useTeam, type TeamBackground, type TeamShirt } from "@/contexts/TeamContext";
import { getAssetFullUrl } from "@/config/fanframe";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import {
  buildDeliveryUrl,
  classifyKioskError,
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
  verifyTechnicalPin,
} from "@/lib/kiosk";
import type { KioskRuntimeConfig, KioskTechnicalStatus, KioskUpdateStatus, StoredDeviceIdentity } from "@/types/kiosk";

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

function KioskButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const baseClassName =
    variant === "primary"
      ? "min-h-[88px] px-10 text-2xl font-black uppercase tracking-wide"
      : variant === "secondary"
        ? "min-h-[76px] px-8 text-xl font-black uppercase"
        : "min-h-[64px] px-6 text-lg font-bold uppercase";

  return (
    <Button
      onClick={onClick}
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
  const [pendingRemoteReload, setPendingRemoteReload] = useState(false);
  const [shirtRailScroll, setShirtRailScroll] = useState<RailScrollState>({ canPrev: false, canNext: false });
  const [backgroundRailScroll, setBackgroundRailScroll] = useState<RailScrollState>({ canPrev: false, canNext: false });
  const [selectedShirt, setSelectedShirt] = useState<TeamShirt | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<TeamBackground | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [pixQrImage, setPixQrImage] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<KioskPaymentResponse | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [retakes, setRetakes] = useState(0);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null);
  const [deliveryQrImage, setDeliveryQrImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shirtRailRef = useRef<HTMLDivElement | null>(null);
  const backgroundRailRef = useRef<HTMLDivElement | null>(null);
  const technicalHoldTimerRef = useRef<number | null>(null);
  const { progress, complete } = useProgress(step === "generating");

  const timeoutSeconds = normalizeKioskTimeout(team?.kiosk_timeout_seconds);
  const visibleShirts = useMemo(() => filterVisibleAssets(team?.shirts || []), [team?.shirts]);
  const visibleBackgrounds = useMemo(() => filterVisibleAssets(team?.backgrounds || []), [team?.backgrounds]);
  const priceLabel = formatCurrencyFromCents(team?.kiosk_price_cents || 0, team?.kiosk_currency || "BRL");
  const activeDevice = useMemo(() => ({
    deviceCode: identity?.deviceCode || config?.deviceCode || "",
    deviceSecret: identity?.deviceSecret || config?.deviceSecret || "",
  }), [config?.deviceCode, config?.deviceSecret, identity?.deviceCode, identity?.deviceSecret]);
  const hasDeviceAuth = Boolean(activeDevice.deviceCode && activeDevice.deviceSecret);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetFlow = useCallback(() => {
    stopCamera();
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
    setRetakes(0);
    setQueueId(null);
    setGeneratedImage(null);
    setDeliveryUrl(null);
    setDeliveryQrImage(null);
  }, [stopCamera, team?.kiosk_enabled]);

  const applyRemoteState = useCallback(async (state: {
    device?: { teamSlug?: string | null; configVersion?: number | null } | null;
  } | null, commandType?: string) => {
    const remoteDevice = state?.device || null;
    const remoteTeamSlug = remoteDevice?.teamSlug || undefined;
    const remoteConfigVersion = Number(remoteDevice?.configVersion || 0);
    const remoteSupportPinHash = remoteDevice?.supportPinHash || undefined;
    const shouldReload = commandType === "sync_config" || shouldReloadForRemoteKioskState(
      identity?.teamSlug || config?.teamSlug,
      identity?.configVersion || 0,
      remoteDevice,
    );

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
    const state = await pollKioskState(activeDevice).catch(() => null);
    await applyRemoteState(state, commandType);
    return state;
  }, [activeDevice, applyRemoteState, hasDeviceAuth]);

  const refreshTechnicalPinHash = useCallback(async () => {
    if (!hasDeviceAuth || !identity) return identity?.supportPinHash || null;
    const state = await pollKioskState(activeDevice).catch(() => null);
    const supportPinHash = state?.device?.supportPinHash || null;
    if (!supportPinHash) return identity.supportPinHash || null;
    const updatedIdentity = { ...identity, supportPinHash };
    await window.fanframeKiosk?.saveDeviceIdentity?.(updatedIdentity).catch(() => undefined);
    setIdentity(updatedIdentity);
    return supportPinHash;
  }, [activeDevice, hasDeviceAuth, identity]);

  const collectHealthPayload = useCallback(async (extra: Record<string, unknown> = {}) => {
    const status = await window.fanframeKiosk?.getTechnicalStatus?.().catch(() => null);
    const paymentStatus = await window.fanframeKiosk?.getPaymentStatus?.().catch(() => null);
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
      updateRailScrollState(backgroundRailRef.current, setBackgroundRailScroll);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, updateRailScrollState, visibleBackgrounds.length, visibleShirts.length]);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlTeam = params.get("team") || localStorage.getItem("fanframe:kiosk-team") || "";
      const runtimeConfig = window.fanframeKiosk
        ? await window.fanframeKiosk.getConfig()
        : { ...browserPreviewConfig, teamSlug: urlTeam };
      const paymentTestModeOverride = localStorage.getItem(paymentTestModeStorageKey);
      const effectiveConfig = {
        ...runtimeConfig,
        simulatePayments: paymentTestModeOverride === null ? runtimeConfig.simulatePayments === true : paymentTestModeOverride === "true",
      };
      const storedIdentity = await window.fanframeKiosk?.loadDeviceIdentity?.();

      setConfig(effectiveConfig);
      if (storedIdentity) {
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
  }, [setSlug]);

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
      }).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [activeDevice, collectHealthPayload, hasDeviceAuth, step]);

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
    if (["home", "boot", "maintenance", "generating", "result"].includes(step)) return;
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
    return stopCamera;
  }, [step, stopCamera, userImage]);

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
    setStep("result");
  }, [complete, queueId, sessionId]);

  const failGeneration = useCallback((message: string) => {
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
      const { data } = await supabase.functions.invoke("create-kiosk-payment", {
        body: {
          action: "status",
          payment_id: paymentId,
        },
      });

      if (data?.paid) {
        clearInterval(interval);
        setStep("camera");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDevice.deviceCode, activeDevice.deviceSecret, config, paymentId, paymentMethod, pixPayment, sessionId]);

  const startSelection = () => {
    if (visibleShirts.length === 0 || visibleBackgrounds.length === 0) {
      setError("Cadastre camisas e cenarios no painel admin antes de usar este totem.");
      setStep("maintenance");
      return;
    }
    setSelectedShirt(visibleShirts[0]);
    setSelectedBackground(visibleBackgrounds[0]);
    if (team?.kiosk_show_shirt_step === false && team?.kiosk_show_background_step === false) {
      setStep("payment");
      return;
    }
    setStep(team?.kiosk_show_shirt_step === false ? "background" : "shirt");
  };

  const goAfterShirt = () => {
    setStep(team?.kiosk_show_background_step === false ? "payment" : "background");
  };

  const startPayment = async (method: PaymentMethod) => {
    if (!team || !config || !selectedShirt || !selectedBackground || !hasDeviceAuth) return;
    setPaymentMethod(method);
    setPaymentBusy(true);
    setError(null);

    const { data, error: paymentError } = await supabase.functions.invoke("create-kiosk-payment", {
      body: {
        action: "create",
        team_slug: team.slug,
        device_code: activeDevice.deviceCode,
        device_secret: activeDevice.deviceSecret,
        method,
        selected_shirt_id: selectedShirt.id,
        selected_background_id: selectedBackground.id,
        simulate: config.simulatePayments && method === "pix",
      },
    });

    if (paymentError || data?.error) {
      setPaymentBusy(false);
      setPaymentMethod(null);
      setError(data?.error || paymentError?.message || "Erro ao iniciar pagamento.");
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

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setUserImage(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
  };

  const retakePhoto = () => {
    if (retakes >= 1) return;
    setRetakes((current) => current + 1);
    setUserImage(null);
  };

  const startGeneration = async () => {
    if (!team || !selectedShirt || !selectedBackground || !userImage || !sessionId || !paymentId) return;
    setStep("generating");
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("generate-tryon", {
      body: {
        userImageBase64: userImage,
        shirtAssetUrl: getAssetFullUrl(selectedShirt.assetPath),
        backgroundAssetUrl: getAssetFullUrl(selectedBackground.assetPath),
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
      setIdentity(stored);
      setConfig((current) => ({
        ...(current || browserPreviewConfig),
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
      message: online ? "Internet disponivel" : "Sem internet no PC",
    });
  };

  const testSupabase = async () => {
    setTechnicalCheck("supabase", { status: "running", message: "Consultando Supabase..." });
    const startedAt = performance.now();
    const { error: pingError } = await supabase.from("teams").select("id").limit(1);
    const elapsedMs = Math.round(performance.now() - startedAt);
    setTechnicalCheck("supabase", {
      status: pingError ? "fail" : "ok",
      message: pingError ? `Falha: ${pingError.message}` : `Supabase respondeu em ${elapsedMs}ms`,
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

  const sendManualDiagnostics = async () => {
    if (!hasDeviceAuth) {
      setTechnicalCheck("diagnostics", { status: "fail", message: "Pareie o totem antes de enviar diagnostico." });
      return;
    }
    setTechnicalCheck("diagnostics", { status: "running", message: "Enviando diagnostico..." });
    try {
      const health = await collectHealthPayload({
        manualDiagnostics: true,
        checks: technicalChecks,
      });
      await reportKioskHealth(activeDevice, {
        health,
        event: {
          eventType: "manual_diagnostics_sent",
          severity: "info",
          payload: { checks: technicalChecks, currentScreen: step, paymentStatus: health.paymentStatus },
        },
      });
      setTechnicalCheck("diagnostics", { status: "ok", message: "Diagnostico enviado para o painel." });
    } catch (err) {
      setTechnicalCheck("diagnostics", {
        status: "fail",
        message: err instanceof Error ? err.message : "Erro ao enviar diagnostico.",
      });
    }
  };

  const startAppUpdate = async () => {
    if (!window.fanframeKiosk?.startAppUpdate) {
      setUpdateMessage("Atualizacao local so funciona no app Windows instalado.");
      return;
    }

    setUpdateBusy(true);
    setUpdateMessage("Preparando atualizacao...");
    try {
      const updater = await window.fanframeKiosk.getUpdateStatus?.();
      setUpdateStatus(updater || null);
      if (updater && !updater.ready) {
        setUpdateMessage(updater.message);
        return;
      }
      const result = await window.fanframeKiosk.startAppUpdate();
      setUpdateMessage(result.message);
    } catch (err) {
      setUpdateMessage(err instanceof Error ? err.message : "Nao foi possivel iniciar a atualizacao.");
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

  const resetKioskInstallation = async () => {
    const confirmed = window.confirm("Resetar este totem? Ele vai perder o pareamento atual e voltar para a tela do codigo de instalacao.");
    if (!confirmed) return;

    stopCamera();
    await window.fanframeKiosk?.clearDeviceIdentity?.().catch(() => undefined);
    localStorage.removeItem("fanframe:kiosk-team");
    setIdentity(null);
    setConfig((current) => current ? { ...current, teamSlug: "", deviceSecret: "" } : current);
    setSlug("");
    setError(null);
    setPairingCode("");
    setPairingError("");
    setTechnicalOpen(false);
    setTechnicalUnlocked(false);
    setPinInput("");
    setTechnicalPinError("");
    setStep("pairing");
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
              if (!identity?.supportPinHash) {
                setTechnicalPinError("PIN tecnico nao configurado neste totem. Peca um novo codigo de instalacao ao administrador.");
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
              <p>Area local limitada para o dono do totem testar conexao, camera, sincronizacao e reiniciar o app.</p>
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
              </dl>
              <dl className="technical-status">
                <div><dt>Internet</dt><dd className={`technical-${technicalChecks.internet.status}`}>{checkText(technicalChecks.internet)}</dd></div>
                <div><dt>Supabase</dt><dd className={`technical-${technicalChecks.supabase.status}`}>{checkText(technicalChecks.supabase)}</dd></div>
                <div><dt>Camera</dt><dd className={`technical-${technicalChecks.camera.status}`}>{checkText(technicalChecks.camera)}</dd></div>
                <div><dt>Pagamentos</dt><dd className={`technical-${technicalChecks.payments.status}`}>{checkText(technicalChecks.payments)}</dd></div>
                <div><dt>Diagnostico</dt><dd className={`technical-${technicalChecks.diagnostics.status}`}>{checkText(technicalChecks.diagnostics)}</dd></div>
                <div><dt>Atualizacao</dt><dd>{updateStatus?.ready ? updateStatus.message : updateStatus?.message || "Nao verificada"}</dd></div>
                <div><dt>Modo teste</dt><dd>{config?.simulatePayments ? "Pagamento teste ligado" : "Pagamento real"}</dd></div>
              </dl>
              <button onClick={runAllTechnicalTests}>Testar tudo</button>
              <button onClick={testInternet}>Testar internet</button>
              <button onClick={testSupabase}>Testar Supabase</button>
              <button onClick={testCamera}>Testar camera</button>
              <button onClick={testPayments}>Testar pagamentos</button>
              <button onClick={sendManualDiagnostics}>Enviar diagnostico</button>
              <button onClick={() => window.location.reload()}>Sincronizar agora</button>
              <button onClick={() => window.fanframeKiosk?.relaunch?.() || window.location.reload()}>Reiniciar app</button>
              <button onClick={togglePaymentTestMode}>{config?.simulatePayments ? "Desligar pagamento teste" : "Ativar pagamento teste"}</button>
              <button onClick={startAppUpdate} disabled={updateBusy}>{updateBusy ? "Atualizando..." : "Atualizar app"}</button>
              <button onClick={() => openTechnicalMode()}>Atualizar diagnostico</button>
              {updateMessage && <p className="technical-note">{updateMessage}</p>}
              <button className="technical-danger" onClick={resetKioskInstallation}>Resetar instalacao</button>
              <button onClick={() => {
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
  } as React.CSSProperties) : undefined;
  const maintenanceError = error ? classifyKioskError(error) : null;

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
            <KioskButton disabled={pairingBusy || !pairingCode.trim()} className="w-full">
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
    <main className="min-h-screen bg-background text-foreground overflow-hidden" style={shellStyle}>
      {renderTechnicalHotspot()}
      <div className="min-h-screen h-screen px-12 py-10 flex flex-col gap-8">
        <header className="shrink-0 flex items-center justify-between border-b border-border pb-6">
          <div className="min-w-0 flex items-center gap-5">
            {team?.logo_url && <img src={team.logo_url} alt={team.name} className="w-20 h-20 object-contain shrink-0" />}
            <div className="min-w-0">
              <p className="text-base uppercase text-muted-foreground font-black tracking-wide">FanFrame Totem</p>
              <h1 className="text-4xl font-black uppercase leading-tight truncate">{team?.name}</h1>
            </div>
          </div>
          <div className="text-right shrink-0 pl-6">
            <p className="text-base text-muted-foreground uppercase font-black">Total</p>
            <p className="text-4xl font-black">{priceLabel}</p>
          </div>
        </header>

        {step === "home" && (
          <section className="flex-1 min-h-0 flex flex-col justify-center text-center">
            <div className="max-w-3xl mx-auto">
              <p className="text-xl uppercase text-muted-foreground font-black mb-5">Experiencia interativa</p>
              <h2 className="text-8xl font-black uppercase leading-[0.92] mb-10">Vista o manto</h2>
              <p className="text-3xl leading-relaxed text-muted-foreground mb-14">
                Escolha sua camisa, pague no totem e receba sua foto por QR Code.
              </p>
              <KioskButton onClick={startSelection} className="w-full">Comecar</KioskButton>
            </div>
          </section>
        )}

        {step === "shirt" && (
          <section className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0">
              <p className="text-lg uppercase text-muted-foreground font-black">Passo 1 de 3</p>
              <h2 className="text-6xl font-black uppercase leading-none mb-8">Escolha a camisa</h2>
            </div>
            <div className="relative flex-1 min-h-0">
              <div
                ref={shirtRailRef}
                onScroll={() => updateRailScrollState(shirtRailRef.current, setShirtRailScroll)}
                className="h-full flex items-center gap-6 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth snap-x snap-mandatory px-24 py-8"
              >
                {visibleShirts.map((shirt) => (
                  <button
                    key={shirt.id}
                    onClick={() => setSelectedShirt(shirt)}
                    className={`snap-center shrink-0 w-[410px] h-[640px] rounded-lg border-2 p-5 bg-card text-left transition flex flex-col shadow-[0_18px_42px_rgb(0_0_0_/_0.28)] ${
                      selectedShirt?.id === shirt.id ? "border-primary bg-accent scale-[1.015]" : "border-border"
                    }`}
                  >
                    <div className="aspect-square rounded-md bg-secondary mb-6 overflow-hidden shrink-0">
                      <img src={shirt.imageUrl} alt={shirt.name} className="w-full h-full object-contain" />
                    </div>
                    <h3 className="text-2xl font-black uppercase leading-tight">{shirt.name}</h3>
                    <p className="text-lg text-muted-foreground leading-snug mt-3 line-clamp-3">{shirt.subtitle}</p>
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-background via-background/80 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-background via-background/80 to-transparent" />
              {visibleShirts.length > 2 && (
                <>
                  <button
                    type="button"
                    aria-label="Ver camisas anteriores"
                    disabled={!shirtRailScroll.canPrev}
                    onClick={() => scrollRail(shirtRailRef.current, "prev")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-28 rounded-r-lg bg-primary text-primary-foreground shadow-xl border border-primary/40 flex items-center justify-center disabled:opacity-25 disabled:grayscale disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-12 h-12" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-label="Ver mais camisas"
                    disabled={!shirtRailScroll.canNext}
                    onClick={() => scrollRail(shirtRailRef.current, "next")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-20 h-28 rounded-l-lg bg-primary text-primary-foreground shadow-xl border border-primary/40 flex items-center justify-center disabled:opacity-25 disabled:grayscale disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-12 h-12" strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
            <footer className="shrink-0 pt-7 grid grid-cols-[0.8fr_1.2fr] gap-5">
              <KioskButton variant="ghost" onClick={resetFlow} className="w-full">Cancelar</KioskButton>
              <KioskButton onClick={goAfterShirt} disabled={!selectedShirt} className="w-full">Continuar</KioskButton>
            </footer>
          </section>
        )}

        {step === "background" && (
          <section className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0">
              <p className="text-lg uppercase text-muted-foreground font-black">Passo 2 de 3</p>
              <h2 className="text-6xl font-black uppercase leading-none mb-8">Escolha o cenario</h2>
            </div>
            <div className="relative flex-1 min-h-0">
              <div
                ref={backgroundRailRef}
                onScroll={() => updateRailScrollState(backgroundRailRef.current, setBackgroundRailScroll)}
                className="h-full flex items-center gap-6 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth snap-x snap-mandatory px-24 py-8"
              >
                {visibleBackgrounds.map((background) => (
                  <button
                    key={background.id}
                    onClick={() => setSelectedBackground(background)}
                    className={`snap-center shrink-0 w-[720px] h-[640px] rounded-lg border-2 p-5 bg-card text-left transition flex flex-col shadow-[0_18px_42px_rgb(0_0_0_/_0.28)] ${
                      selectedBackground?.id === background.id ? "border-primary bg-accent scale-[1.015]" : "border-border"
                    }`}
                  >
                    <div className="aspect-[16/9] rounded-md bg-secondary mb-6 overflow-hidden shrink-0">
                      <img src={background.imageUrl} alt={background.name} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-3xl font-black uppercase leading-tight">{background.name}</h3>
                    <p className="text-xl text-muted-foreground mt-3 line-clamp-3">{background.subtitle}</p>
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-background via-background/80 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-background via-background/80 to-transparent" />
              {visibleBackgrounds.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Ver cenarios anteriores"
                    disabled={!backgroundRailScroll.canPrev}
                    onClick={() => scrollRail(backgroundRailRef.current, "prev")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-20 h-28 rounded-r-lg bg-primary text-primary-foreground shadow-xl border border-primary/40 flex items-center justify-center disabled:opacity-25 disabled:grayscale disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-12 h-12" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-label="Ver mais cenarios"
                    disabled={!backgroundRailScroll.canNext}
                    onClick={() => scrollRail(backgroundRailRef.current, "next")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-20 h-28 rounded-l-lg bg-primary text-primary-foreground shadow-xl border border-primary/40 flex items-center justify-center disabled:opacity-25 disabled:grayscale disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-12 h-12" strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
            <footer className="shrink-0 pt-7 grid grid-cols-[0.8fr_1.2fr] gap-5">
              <KioskButton variant="ghost" onClick={() => setStep("shirt")} className="w-full">Voltar</KioskButton>
              <KioskButton onClick={() => setStep("payment")} disabled={!selectedBackground} className="w-full">Pagar</KioskButton>
            </footer>
          </section>
        )}

        {step === "payment" && (
          <section className="flex-1 min-h-0 flex flex-col justify-center">
            <div className="w-full text-center">
              <p className="text-lg uppercase text-muted-foreground font-black">Passo 3 de 3</p>
              <h2 className="text-6xl font-black uppercase mb-5">Pagamento</h2>
              <p className="text-4xl font-black mb-12">{priceLabel}</p>

              {!paymentMethod && (
                <div className="grid grid-cols-1 gap-5">
                  <button className="min-h-[190px] rounded-lg bg-card border-2 border-border p-8 flex items-center gap-8 text-left active:scale-[0.99] transition" onClick={() => startPayment("pix")}>
                    <QrCode className="w-20 h-20 shrink-0" />
                    <span>
                      <span className="block text-4xl font-black uppercase">Pagar com PIX</span>
                      <span className="block text-xl text-muted-foreground mt-3">Aponte a camera do celular para o QR Code.</span>
                    </span>
                  </button>
                </div>
              )}

              {paymentBusy && (
                <div className="py-20">
                  <Loader2 className="w-24 h-24 animate-spin mx-auto mb-8" />
                  <p className="text-4xl font-black uppercase">Aguardando pagamento</p>
                </div>
              )}

              {paymentMethod === "pix" && pixPayment && (
                <div className="flex flex-col items-center">
                  {pixQrImage ? (
                    <img src={pixQrImage} alt="QR Code PIX" className="w-[520px] h-[520px] bg-white p-4 rounded-lg mb-8" />
                  ) : (
                    <Loader2 className="w-24 h-24 animate-spin mb-8" />
                  )}
                  <p className="text-3xl leading-relaxed text-muted-foreground mb-8">Aponte a camera do celular para pagar com PIX.</p>
                  <KioskButton variant="ghost" onClick={resetFlow} className="w-full">Cancelar</KioskButton>
                </div>
              )}

              {error && <p className="mt-8 text-destructive text-2xl font-bold leading-relaxed">{error}</p>}
            </div>
          </section>
        )}

        {step === "camera" && (
          <section className="flex-1 min-h-0 flex flex-col items-center">
            <h2 className="shrink-0 text-6xl font-black uppercase mb-7">Sua foto</h2>
            <div className="w-full flex-1 min-h-0 rounded-lg overflow-hidden bg-card border-2 border-border mb-7">
              {userImage ? (
                <img src={userImage} alt="Foto capturada" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              )}
            </div>
            <div className="shrink-0 w-full grid grid-cols-2 gap-5">
              {userImage ? (
                <>
                  <KioskButton variant="secondary" onClick={retakePhoto} disabled={retakes >= 1} className="w-full">
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Refazer
                  </KioskButton>
                  <KioskButton onClick={startGeneration} className="w-full">Usar foto</KioskButton>
                </>
              ) : (
                <KioskButton onClick={capturePhoto} className="w-full col-span-2">
                  <Camera className="w-6 h-6 mr-3" />
                  Capturar
                </KioskButton>
              )}
            </div>
          </section>
        )}

        {step === "generating" && (
          <section className="flex-1 min-h-0 grid place-items-center text-center">
            <div className="max-w-2xl w-full">
              <Loader2 className="w-28 h-28 animate-spin mx-auto mb-10" />
              <h2 className="text-6xl font-black uppercase leading-none mb-6">Gerando imagem</h2>
              <p className="text-2xl text-muted-foreground mb-10">Nao feche nem desligue o totem.</p>
              <Progress value={progress} className="h-6 mb-6" />
              <p className="text-5xl font-black">{progress}%</p>
            </div>
          </section>
        )}

        {step === "result" && (
          <section className="flex-1 min-h-0 flex flex-col text-center">
            <div className="shrink-0">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
              <h2 className="text-6xl font-black uppercase leading-none mb-6">Imagem pronta</h2>
            </div>
            <div className="flex-1 min-h-0 rounded-lg bg-card border-2 border-border overflow-hidden mb-7">
              {generatedImage && <img src={generatedImage} alt="Imagem gerada" className="w-full h-full object-contain" />}
            </div>
            <div className="shrink-0 grid grid-cols-[320px_1fr] gap-7 items-center text-left">
              {deliveryQrImage && <img src={deliveryQrImage} alt="QR Code de download" className="w-80 h-80 bg-white p-3 rounded-lg" />}
              <div>
                <p className="text-3xl font-black uppercase leading-tight mb-5">Escaneie para baixar no celular</p>
                <KioskButton variant="secondary" onClick={resetFlow} className="w-full">Finalizar</KioskButton>
              </div>
            </div>
          </section>
        )}
      </div>
      {renderTechnicalOverlay()}
    </main>
  );
}
