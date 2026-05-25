import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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
