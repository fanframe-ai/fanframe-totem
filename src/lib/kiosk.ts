export interface VisibleAsset {
  visible?: boolean | null;
}

export function formatCurrencyFromCents(amountCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100).replace(/\u00a0/g, " ");
}

export function filterVisibleAssets<T extends VisibleAsset>(assets: T[]) {
  return assets.filter((asset) => asset.visible !== false);
}

export function normalizeKioskTimeout(seconds: number | null | undefined) {
  if (!seconds || Number.isNaN(seconds)) return 60;
  return Math.min(180, Math.max(15, Math.round(seconds)));
}

export function buildDeliveryUrl(supabaseUrl: string, token: string) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/functions/v1/create-delivery-link?token=${encodeURIComponent(token)}`;
}
