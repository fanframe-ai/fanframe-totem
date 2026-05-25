import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, QrCode, RefreshCw } from "lucide-react";
import "./kioskVisual.css";

type KioskVisualShellProps = {
  className?: string;
  shellStyle?: CSSProperties;
  backgroundImage?: string;
  waitingVideo?: string;
  showWaitingVideo?: boolean;
  ghostLogoUrl?: string;
  logoUrl?: string;
  logoAlt?: string;
  brandLabel: ReactNode;
  teamName: ReactNode;
  totalLabel: ReactNode;
  priceLabel: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  technicalHotspot?: ReactNode;
  technicalOverlay?: ReactNode;
  children: ReactNode;
};

type KioskHomeVisualProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: ReactNode;
  afterLabel?: ReactNode;
  cta: ReactNode;
  onMediaSelect?: () => void;
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
  waitingVideo,
  showWaitingVideo,
  ghostLogoUrl,
  logoUrl,
  logoAlt = "",
  brandLabel,
  teamName,
  totalLabel,
  priceLabel,
  backLabel = "Voltar",
  onBack,
  technicalHotspot,
  technicalOverlay,
  children,
}: KioskVisualShellProps) {
  return (
    <main className={`ff-kiosk-shell ${className}`.trim()} style={shellStyle}>
      {technicalHotspot}
      <div className="ff-kiosk-bg-layer">
        {backgroundImage && <img src={backgroundImage} alt="" className="ff-kiosk-bg-media" />}
        {waitingVideo && showWaitingVideo && (
          <video src={waitingVideo} className="ff-kiosk-bg-video" autoPlay loop muted playsInline />
        )}
        <div className="ff-kiosk-bg-scrim" />
        {ghostLogoUrl && <img src={ghostLogoUrl} alt="" className="ff-kiosk-bg-logo" />}
      </div>
      <div className="ff-kiosk-content">
        <header className="ff-kiosk-header">
          <div className="ff-kiosk-brand">
            {logoUrl && <img src={logoUrl} alt={logoAlt} className="ff-kiosk-header-logo" />}
            <div className="ff-kiosk-brand-copy">
              <div className="ff-kiosk-brand-label">{brandLabel}</div>
              <h1 className="ff-kiosk-team-name">{teamName}</h1>
            </div>
          </div>
          <div className="ff-kiosk-price">
            <div className="ff-kiosk-total-label">{totalLabel}</div>
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
  eyebrow,
  title,
  subtitle,
  beforeImage,
  afterImage,
  beforeLabel = "Antes",
  afterLabel = "Depois",
  cta,
  onMediaSelect,
}: KioskHomeVisualProps) {
  return (
    <section className="ff-kiosk-home">
      <div className="ff-kiosk-home-copy">
        <div className="ff-kiosk-home-eyebrow">{eyebrow}</div>
        <h2 className="ff-kiosk-home-title">{title}</h2>
        <div className="ff-kiosk-home-subtitle">{subtitle}</div>
      </div>
      <div className="ff-kiosk-home-media">
        <button type="button" className="ff-kiosk-home-card" onClick={onMediaSelect}>
          <div className="ff-kiosk-home-card-label">
            <span>{beforeLabel}</span>
            <i />
          </div>
          {beforeImage ? <img src={beforeImage} alt="" /> : <strong>{beforeLabel}</strong>}
        </button>
        <button type="button" className="ff-kiosk-home-card is-highlighted" onClick={onMediaSelect}>
          <div className="ff-kiosk-home-card-label">
            <span>{afterLabel}</span>
            <i />
          </div>
          {afterImage ? <img src={afterImage} alt="" /> : <strong>{afterLabel}</strong>}
        </button>
      </div>
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
  onSelect,
}: KioskSelectionVisualProps) {
  const isBackground = kind === "background";
  const showArrows = items.length > (isBackground ? 1 : 2);

  return (
    <section className={`ff-kiosk-selection ff-kiosk-selection-${kind}`}>
      <div className="ff-kiosk-selection-heading">
        <div>
          <div className="ff-kiosk-selection-step">{stepLabel}</div>
          <h2 className="ff-kiosk-selection-title">{title}</h2>
        </div>
        {backControl}
      </div>
      <div className="ff-kiosk-selection-stage">
        <div ref={railRef} onScroll={onRailScroll} className="ff-kiosk-selection-rail">
          {items.length ? (
            items.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`ff-kiosk-selection-card ${selectedId === item.id ? "is-selected" : ""}`}
                onClick={() => onSelect?.(item, index)}
              >
                <div className="ff-kiosk-selection-image">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <strong>{emptyLabel}</strong>}
                </div>
                <h3>{item.name}</h3>
                {item.subtitle && <p>{item.subtitle}</p>}
              </button>
            ))
          ) : (
            <div className="ff-kiosk-selection-empty">{emptyLabel}</div>
          )}
        </div>
        <div className="ff-kiosk-rail-fade ff-kiosk-rail-fade-left" />
        <div className="ff-kiosk-rail-fade ff-kiosk-rail-fade-right" />
        {showArrows && (
          <>
            <button type="button" aria-label="Anterior" disabled={!canPrev} onClick={onPrev} className="ff-kiosk-rail-arrow ff-kiosk-rail-arrow-left">
              <ChevronLeft />
            </button>
            <button type="button" aria-label="Proximo" disabled={!canNext} onClick={onNext} className="ff-kiosk-rail-arrow ff-kiosk-rail-arrow-right">
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      <footer className="ff-kiosk-selection-footer">{cta}</footer>
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
            <button type="button" className="ff-kiosk-primary-action" onClick={onUsePhoto}>{usePhotoLabel}</button>
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
