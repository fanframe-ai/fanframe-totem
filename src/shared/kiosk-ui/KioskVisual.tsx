import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, ReactNode, WheelEvent } from "react";
import { ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, QrCode, RefreshCw, Shirt } from "lucide-react";
import "./kioskVisual.css";

type KioskVisualShellProps = {
  className?: string;
  shellStyle?: CSSProperties;
  backgroundImage?: string;
  backgroundVideo?: string;
  waitingVideo?: string;
  showWaitingVideo?: boolean;
  logoUrl?: string;
  logoMode?: "compact" | "horizontal";
  logoAlt?: string;
  brandLabel: ReactNode;
  teamName: ReactNode;
  totalLabel: ReactNode;
  priceLabel: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  onLogoSelect?: () => void;
  technicalHotspot?: ReactNode;
  technicalOverlay?: ReactNode;
  children: ReactNode;
};

type KioskHomeVisualProps = {
  homeLayout?: "default" | "campaign_poster";
  eyebrow: ReactNode;
  title: ReactNode;
  titleAccent?: ReactNode;
  titleImage?: string;
  subtitle: ReactNode;
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: ReactNode;
  afterLabel?: ReactNode;
  benefits?: Array<{ icon: "shirt" | "camera" | "qr"; label: ReactNode }>;
  cta: ReactNode;
  onMediaSelect?: (target: "before" | "after") => void;
};

export type KioskSelectionVisualItem = {
  id: string;
  name: ReactNode;
  subtitle?: ReactNode;
  imageUrl?: string;
};

type KioskSelectionVisualProps = {
  stepLabel: ReactNode;
  title: ReactNode;
  items: KioskSelectionVisualItem[];
  selectedId?: string;
  kind: "shirt" | "background";
  emptyLabel: ReactNode;
  cta: ReactNode;
  backControl?: ReactNode;
  railRef?: React.Ref<HTMLDivElement>;
  onRailScroll?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onFocusChange?: (item: KioskSelectionVisualItem, index: number) => void;
  onSelect?: (item: KioskSelectionVisualItem, index: number) => void;
};

type KioskPaymentVisualProps = {
  stepLabel: ReactNode;
  title: ReactNode;
  priceLabel: ReactNode;
  pixCta: ReactNode;
  pixHint: ReactNode;
  waitingLabel: ReactNode;
  qrHint: ReactNode;
  cancelLabel: ReactNode;
  status: "choose" | "busy" | "qr";
  qrImage?: string;
  error?: ReactNode;
  onStartPix?: () => void;
  onCancel?: () => void;
};

type KioskCpfVisualProps = {
  stepLabel: ReactNode;
  title: ReactNode;
  hint: ReactNode;
  value: string;
  error?: ReactNode;
  continueLabel: ReactNode;
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onContinue: () => void;
};

type KioskRecoveryPhoto = {
  sessionId: string;
  imageUrl: string;
  completedAt: string;
};

type KioskRecoveryResultsVisualProps = {
  title: ReactNode;
  hint: ReactNode;
  photos: KioskRecoveryPhoto[];
  busySessionId?: string | null;
  error?: ReactNode;
  onSelect: (photo: KioskRecoveryPhoto) => void;
};

type KioskCameraVisualProps = {
  title: ReactNode;
  media: ReactNode;
  hasPhoto: boolean;
  countdown?: number | null;
  captureLabel: ReactNode;
  retakeLabel: ReactNode;
  usePhotoLabel: ReactNode;
  onCapture?: () => void;
  onRetake?: () => void;
  onUsePhoto?: () => void;
};

type KioskCameraReadyVisualProps = {
  title: ReactNode;
  hint: ReactNode;
  buttonLabel: ReactNode;
  countdownSeconds: number;
  onStart?: () => void;
};

type KioskGeneratingVisualProps = {
  teamName?: ReactNode;
  slideImage?: string;
  logoUrl?: string;
  slideTitle?: ReactNode;
  slideSubtitle?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  progress: number;
  progressLabel: ReactNode;
  hasWaitingVideo?: boolean;
};

type KioskResultVisualProps = {
  title: ReactNode;
  image?: string;
  qrImage?: string;
  hint: ReactNode;
  finishLabel: ReactNode;
  onFinish?: () => void;
};

export function KioskVisualShell({
  className = "",
  shellStyle,
  backgroundImage,
  backgroundVideo,
  waitingVideo,
  showWaitingVideo,
  logoUrl,
  logoMode = "compact",
  logoAlt = "",
  brandLabel,
  teamName,
  totalLabel,
  priceLabel,
  backLabel = "Voltar",
  onBack,
  onLogoSelect,
  technicalHotspot,
  technicalOverlay,
  children,
}: KioskVisualShellProps) {
  return (
    <main className={`ff-kiosk-shell ${className}`.trim()} style={shellStyle}>
      {technicalHotspot}
      <div className="ff-kiosk-bg-layer">
        {backgroundVideo ? (
          <video src={backgroundVideo} className="ff-kiosk-bg-video ff-kiosk-bg-video-home" autoPlay loop muted playsInline />
        ) : (
          backgroundImage && <img src={backgroundImage} alt="" className="ff-kiosk-bg-media" />
        )}
        {waitingVideo && showWaitingVideo && (
          <video src={waitingVideo} className="ff-kiosk-bg-video" autoPlay loop muted playsInline />
        )}
        <div className="ff-kiosk-bg-scrim" />
      </div>
      <div className="ff-kiosk-content">
        <header className="ff-kiosk-header">
          <div className="ff-kiosk-brand">
            {logoUrl && (
              onLogoSelect ? (
                <button type="button" className={`ff-kiosk-header-logo-button ${logoMode === "horizontal" ? "is-horizontal" : ""}`.trim()} onClick={onLogoSelect}>
                  <img src={logoUrl} alt={logoAlt} className={`ff-kiosk-header-logo ${logoMode === "horizontal" ? "is-horizontal" : ""}`.trim()} />
                </button>
              ) : (
                <img src={logoUrl} alt={logoAlt} className={`ff-kiosk-header-logo ${logoMode === "horizontal" ? "is-horizontal" : ""}`.trim()} />
              )
            )}
            {logoMode !== "horizontal" && (
              <div className="ff-kiosk-brand-copy">
                <div className="ff-kiosk-brand-label">{brandLabel}</div>
                <h1 className="ff-kiosk-team-name">{teamName}</h1>
              </div>
            )}
          </div>
          <div className="ff-kiosk-price">
            <div className="ff-kiosk-price-copy">
              <span>Sua foto oficial</span>
              <span>por apenas</span>
            </div>
            <div className="ff-kiosk-price-value">{priceLabel}</div>
          </div>
        </header>

        {onBack && (
          <button type="button" aria-label={backLabel} onClick={onBack} className="ff-kiosk-back">
            <ArrowLeft aria-hidden="true" />
          </button>
        )}

        {children}
      </div>
      {technicalOverlay}
    </main>
  );
}

export function KioskHomeVisual({
  homeLayout = "default",
  eyebrow,
  title,
  titleAccent,
  titleImage,
  subtitle,
  beforeImage,
  afterImage,
  beforeLabel = "Antes",
  afterLabel = "Depois",
  benefits,
  cta,
  onMediaSelect,
}: KioskHomeVisualProps) {
  const isCampaignPoster = homeLayout === "campaign_poster";
  const escapedTitleAccent = typeof titleAccent === "string"
    ? titleAccent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : "";
  const visibleTitle = typeof title === "string" && typeof titleAccent === "string"
    ? title.replace(new RegExp(`\\s*${escapedTitleAccent}\\s*$`, "i"), "").trim() || title
    : title;
  const visibleBenefits = benefits?.length ? benefits : [
    { icon: "shirt" as const, label: "Escolha seu manto" },
    { icon: "camera" as const, label: "Entre no clima da Nacao" },
    { icon: "qr" as const, label: "Receba sua foto por QR Code" },
  ];

  return (
    <section className={`ff-kiosk-home ${isCampaignPoster ? "is-campaign-poster" : ""}`.trim()}>
      <div className="ff-kiosk-home-copy">
        <div className="ff-kiosk-home-eyebrow">{eyebrow}</div>
        {titleImage ? (
          <img src={titleImage} alt={typeof title === "string" ? title : "Vista o manto"} className="ff-kiosk-home-title-image" />
        ) : (
          <h2 className="ff-kiosk-home-title">
            <span>{visibleTitle}</span>
            {titleAccent && <strong className="ff-kiosk-home-brush-title">{titleAccent}</strong>}
          </h2>
        )}
        <div className="ff-kiosk-home-subtitle">{subtitle}</div>
      </div>
      <div className="ff-kiosk-home-media">
        <button type="button" className="ff-kiosk-home-card" onClick={() => onMediaSelect?.("before")}>
          <div className="ff-kiosk-home-card-label">
            <span>{beforeLabel}</span>
            <i />
          </div>
          {beforeImage ? <img src={beforeImage} alt="" /> : <strong>{beforeLabel}</strong>}
        </button>
        {isCampaignPoster && <div className="ff-kiosk-home-transform-arrow" aria-hidden="true">{"\u00bb"}</div>}
        <button type="button" className="ff-kiosk-home-card is-highlighted" onClick={() => onMediaSelect?.("after")}>
          <div className="ff-kiosk-home-card-label">
            <span>{afterLabel}</span>
            <i />
          </div>
          {afterImage ? <img src={afterImage} alt="" /> : <strong>{afterLabel}</strong>}
        </button>
      </div>
      {isCampaignPoster && (
        <div className="ff-kiosk-home-benefits">
          {visibleBenefits.map((benefit, index) => {
            const Icon = benefit.icon === "shirt" ? Shirt : benefit.icon === "camera" ? Camera : QrCode;
            return (
              <div className="ff-kiosk-home-benefit" key={index}>
                <span><Icon aria-hidden="true" /></span>
                <strong>{benefit.label}</strong>
              </div>
            );
          })}
        </div>
      )}
      {cta}
    </section>
  );
}

export function KioskSelectionVisual({
  stepLabel,
  title,
  items,
  selectedId,
  kind,
  emptyLabel,
  cta,
  backControl,
  railRef,
  onRailScroll,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onFocusChange,
  onSelect,
}: KioskSelectionVisualProps) {
  const isBackground = kind === "background";
  const isShirtCarousel = kind === "shirt";
  const localRailRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const showArrows = items.length > (isBackground ? 1 : 2);
  const setRailNode = useCallback((node: HTMLDivElement | null) => {
    localRailRef.current = node;
    if (typeof railRef === "function") {
      railRef(node);
    } else if (railRef && "current" in railRef) {
      (railRef as { current: HTMLDivElement | null }).current = node;
    }
  }, [railRef]);
  const scrollItemIntoView = useCallback((itemId: string) => {
    window.requestAnimationFrame(() => {
      const escapedItemId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(itemId)
        : itemId.replace(/"/g, '\\"');
      const target = localRailRef.current?.querySelector<HTMLElement>(`[data-selection-id="${escapedItemId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      onRailScroll?.();
    });
  }, [onRailScroll]);
  const handleSelect = useCallback((item: KioskSelectionVisualItem, index: number, element?: HTMLElement | null) => {
    onSelect?.(item, index);
    if (isShirtCarousel) {
      localRailRef.current?.scrollTo({ left: 0, behavior: "instant" });
      return;
    }
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return;
    }
    scrollItemIntoView(item.id);
  }, [isShirtCarousel, onSelect, scrollItemIntoView]);
  const handleCarouselStep = useCallback((direction: "prev" | "next") => {
    if (!isShirtCarousel) {
      if (direction === "prev") onPrev?.();
      else onNext?.();
      return;
    }
    const nextIndex = Math.min(items.length - 1, Math.max(0, selectedIndex + (direction === "next" ? 1 : -1)));
    const nextItem = items[nextIndex];
    if (!nextItem || nextIndex === selectedIndex) return;
    onFocusChange?.(nextItem, nextIndex);
    localRailRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [isShirtCarousel, items, onFocusChange, onNext, onPrev, selectedIndex]);
  useEffect(() => {
    if (!isShirtCarousel) return;
    localRailRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [isShirtCarousel, selectedIndex]);
  const handleRailWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const rail = event.currentTarget;
    if (rail.scrollWidth <= rail.clientWidth) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY;
    onRailScroll?.();
  };

  return (
    <section className={`ff-kiosk-selection ff-kiosk-selection-${kind} ${isShirtCarousel ? "ff-kiosk-selection-3d" : ""}`}>
      <div className="ff-kiosk-selection-heading">
        <div>
          <div className="ff-kiosk-selection-step">{stepLabel}</div>
          <h2 className="ff-kiosk-selection-title">{title}</h2>
        </div>
        {backControl}
      </div>
      <div className="ff-kiosk-selection-stage">
        <div ref={setRailNode} onScroll={onRailScroll} onWheel={handleRailWheel} className="ff-kiosk-selection-rail">
          {items.length ? (
            items.map((item, index) => {
              const offset = index - selectedIndex;
              const depthClass = isShirtCarousel
                ? offset === 0
                  ? "is-selected is-center"
                  : offset === -1
                    ? "is-prev"
                    : offset === 1
                      ? "is-next"
                      : offset < -1
                        ? "is-far-prev"
                        : "is-far-next"
                : selectedId === item.id
                  ? "is-selected"
                  : "";

              return (
                <button
                  type="button"
                  key={item.id}
                  data-selection-id={item.id}
                  className={`ff-kiosk-selection-card ${depthClass}`}
                  onClick={(event) => handleSelect(item, index, event.currentTarget)}
                >
                  <div className="ff-kiosk-selection-image">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <strong>{emptyLabel}</strong>}
                  </div>
                  <h3>{item.name}</h3>
                  {item.subtitle && <p>{item.subtitle}</p>}
                </button>
              );
            })
          ) : (
            <div className="ff-kiosk-selection-empty">{emptyLabel}</div>
          )}
        </div>
        <div className="ff-kiosk-rail-fade ff-kiosk-rail-fade-left" />
        <div className="ff-kiosk-rail-fade ff-kiosk-rail-fade-right" />
        {isShirtCarousel && items.length > 1 && (
          <div className="ff-kiosk-carousel-progress" aria-hidden="true">
            {items.map((item, index) => (
              <span key={item.id} className={index === selectedIndex ? "is-active" : ""} />
            ))}
          </div>
        )}
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              disabled={isShirtCarousel ? selectedIndex <= 0 : !canPrev}
              onClick={(event) => {
                event.stopPropagation();
                handleCarouselStep("prev");
              }}
              className="ff-kiosk-rail-arrow ff-kiosk-rail-arrow-left"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              aria-label="Proximo"
              disabled={isShirtCarousel ? selectedIndex >= items.length - 1 : !canNext}
              onClick={(event) => {
                event.stopPropagation();
                handleCarouselStep("next");
              }}
              className="ff-kiosk-rail-arrow ff-kiosk-rail-arrow-right"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      {cta && !isShirtCarousel && <footer className="ff-kiosk-selection-footer">{cta}</footer>}
    </section>
  );
}

export function KioskPaymentVisual({
  stepLabel,
  title,
  priceLabel,
  pixCta,
  pixHint,
  waitingLabel,
  qrHint,
  cancelLabel,
  status,
  qrImage,
  error,
  onStartPix,
  onCancel,
}: KioskPaymentVisualProps) {
  return (
    <section className="ff-kiosk-payment">
      <div className="ff-kiosk-payment-inner">
        <div className="ff-kiosk-selection-step">{stepLabel}</div>
        <h2 className="ff-kiosk-payment-title">{title}</h2>
        <div className="ff-kiosk-payment-price">{priceLabel}</div>

        {status === "choose" && (
          <button type="button" className="ff-kiosk-pix-card" onClick={onStartPix}>
            <QrCode />
            <span>
              <strong>{pixCta}</strong>
              <small>{pixHint}</small>
            </span>
          </button>
        )}

        {status === "busy" && (
          <div className="ff-kiosk-payment-busy">
            <Loader2 />
            <p>{waitingLabel}</p>
          </div>
        )}

        {status === "qr" && (
          <div className="ff-kiosk-payment-qr">
            {qrImage ? <img src={qrImage} alt="QR Code PIX" /> : <Loader2 />}
            <p>{qrHint}</p>
            <button type="button" className="ff-kiosk-ghost-action" onClick={onCancel}>{cancelLabel}</button>
          </div>
        )}

        {error && <p className="ff-kiosk-error">{error}</p>}
      </div>
    </section>
  );
}

export function KioskCpfVisual({
  stepLabel,
  title,
  hint,
  value,
  error,
  continueLabel,
  disabled,
  onDigit,
  onBackspace,
  onClear,
  onContinue,
}: KioskCpfVisualProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "limpar", "0", "apagar"];

  return (
    <section className="ff-kiosk-cpf">
      <div className="ff-kiosk-cpf-inner">
        <div className="ff-kiosk-selection-step">{stepLabel}</div>
        <h2 className="ff-kiosk-cpf-title">{title}</h2>
        <p>{hint}</p>
        <output className="ff-kiosk-cpf-display" aria-live="polite">{value || "000.000.000-00"}</output>
        {error && <p className="ff-kiosk-error">{error}</p>}
        <div className="ff-kiosk-cpf-keypad">
          {keys.map((key) => {
            const isDigit = /^\d$/.test(key);
            const label = key === "limpar" ? "Limpar" : key === "apagar" ? "Apagar" : key;
            return (
              <button
                type="button"
                key={key}
                className={isDigit ? "is-digit" : ""}
                onClick={() => {
                  if (isDigit) onDigit(key);
                  else if (key === "limpar") onClear();
                  else onBackspace();
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button type="button" className="ff-kiosk-primary-action" disabled={disabled} onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </section>
  );
}

export function KioskRecoveryResultsVisual({
  title,
  hint,
  photos,
  busySessionId,
  error,
  onSelect,
}: KioskRecoveryResultsVisualProps) {
  return (
    <section className="ff-kiosk-recovery-results">
      <div className="ff-kiosk-recovery-results-inner">
        <h2>{title}</h2>
        <p>{hint}</p>
        {error && <p className="ff-kiosk-error">{error}</p>}
        <div className="ff-kiosk-recovery-grid">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.sessionId}
              className="ff-kiosk-recovery-card"
              disabled={Boolean(busySessionId)}
              onClick={() => onSelect(photo)}
            >
              <img src={photo.imageUrl} alt="Foto gerada anteriormente" />
              <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(photo.completedAt))}</span>
              <strong>{busySessionId === photo.sessionId ? "Preparando QR Code..." : "Abrir esta foto"}</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function KioskCameraVisual({
  title,
  media,
  hasPhoto,
  countdown,
  captureLabel,
  retakeLabel,
  usePhotoLabel,
  onCapture,
  onRetake,
  onUsePhoto,
}: KioskCameraVisualProps) {
  return (
    <section className="ff-kiosk-camera">
      <h2>{title}</h2>
      <div className="ff-kiosk-camera-frame">
        {media}
        {countdown !== null && countdown !== undefined && !hasPhoto && (
          <div className="ff-kiosk-camera-countdown">
            <div>{countdown}</div>
          </div>
        )}
      </div>
      <div className="ff-kiosk-camera-actions">
        {hasPhoto ? (
          <>
            <button type="button" className="ff-kiosk-secondary-action" onClick={onRetake}>
              <RefreshCw />
              {retakeLabel}
            </button>
            <button type="button" className="ff-kiosk-primary-action" onClick={onUsePhoto}>
              {usePhotoLabel}
            </button>
          </>
        ) : (
          <button type="button" className="ff-kiosk-primary-action is-wide" disabled={countdown !== null && countdown !== undefined} onClick={onCapture}>
            <Camera />
            {countdown !== null && countdown !== undefined ? `${captureLabel} ${countdown}` : captureLabel}
          </button>
        )}
      </div>
    </section>
  );
}

export function KioskCameraReadyVisual({
  title,
  hint,
  buttonLabel,
  countdownSeconds,
  onStart,
}: KioskCameraReadyVisualProps) {
  return (
    <section className="ff-kiosk-camera-ready">
      <div className="ff-kiosk-camera-ready-card">
        <Camera />
        <span>{countdownSeconds}s</span>
        <h2>{title}</h2>
        <p>{hint}</p>
        <button type="button" className="ff-kiosk-primary-action is-wide" onClick={onStart}>
          <Camera />
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}

export function KioskGeneratingVisual({
  teamName,
  slideImage,
  logoUrl,
  slideTitle,
  slideSubtitle,
  title,
  subtitle,
  progress,
  progressLabel,
  hasWaitingVideo,
}: KioskGeneratingVisualProps) {
  const statusPhrases = ["Preparando sua foto", "Ajustando o manto", "Finalizando detalhes"];

  return (
    <section className="ff-kiosk-generating">
      {slideImage ? (
        <img src={slideImage} alt="" className={`ff-kiosk-generating-media ${hasWaitingVideo ? "is-muted" : ""}`} />
      ) : logoUrl ? (
        <div className="ff-kiosk-generating-logo"><img src={logoUrl} alt="" /></div>
      ) : null}
      <div className="ff-kiosk-generating-scrim" />
      <div className="ff-kiosk-generating-copy">
        {teamName && <p>{teamName}</p>}
        <h2>{slideTitle || "Sua foto esta ficando pronta"}</h2>
        {slideSubtitle && <span>{slideSubtitle}</span>}
      </div>
      <div className="ff-kiosk-generating-progress">
        <div className="ff-kiosk-generating-status">
          <Loader2 />
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
            <div className="ff-kiosk-generating-phrases" aria-hidden="true">
              {statusPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}
            </div>
          </div>
          <strong>{progressLabel}</strong>
        </div>
        <div className="ff-kiosk-progress-track"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
      </div>
    </section>
  );
}

export function KioskResultVisual({
  title,
  image,
  qrImage,
  hint,
  finishLabel,
  onFinish,
}: KioskResultVisualProps) {
  return (
    <section className="ff-kiosk-result">
      <div className="ff-kiosk-result-heading">
        <CheckCircle2 />
        <h2>{title}</h2>
      </div>
      <div className="ff-kiosk-result-image">
        {image ? <img src={image} alt="Imagem gerada" /> : <strong>Foto IA</strong>}
      </div>
      <div className="ff-kiosk-result-delivery">
        {qrImage ? <img src={qrImage} alt="QR Code de download" /> : <div className="ff-kiosk-result-fake-qr">QR</div>}
        <div>
          <p>{hint}</p>
          <button type="button" className="ff-kiosk-secondary-action" onClick={onFinish} onPointerUp={onFinish}>{finishLabel}</button>
        </div>
      </div>
    </section>
  );
}
