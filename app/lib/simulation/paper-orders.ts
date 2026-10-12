export function milliAssetForNotional(
  notionalCents: number,
  priceCents: number
) {
  if (!Number.isFinite(notionalCents) || notionalCents <= 0 || priceCents <= 0)
    return 0;
  return Math.round((notionalCents * 1000) / priceCents);
}

export function orderNotionalCents(sizeMilliAsset: number, priceCents: number) {
  return Math.round((sizeMilliAsset * priceCents) / 1000);
}

export function minimumOrderNotionalCents(priceCents: number) {
  return Math.max(1, orderNotionalCents(1, priceCents));
}
