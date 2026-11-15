export type ExchangeRates = {
  date: string;
  publishedAt: string;
  fetchedAt: string;
  source: "maib";
  mdlPerEur: number;
  mdlPerUsd: number;
  stale?: boolean;
};
export function validRates(value: unknown): value is ExchangeRates {
  const r = value as ExchangeRates;
  return (
    !!r &&
    r.source === "maib" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Number.isFinite(Date.parse(r.publishedAt)) &&
    Number.isFinite(Date.parse(r.fetchedAt)) &&
    Number.isFinite(r.mdlPerEur) &&
    r.mdlPerEur > 0 &&
    Number.isFinite(r.mdlPerUsd) &&
    r.mdlPerUsd > 0
  );
}
export function freshRates(
  value: unknown,
  now = Date.now(),
): value is ExchangeRates {
  if (!validRates(value)) return false;
  const age = now - Date.parse(value.publishedAt);
  return age >= -5 * 60000 && age <= 48 * 3600000;
}
export function convertMdl(amount: number, rates: ExchangeRates) {
  if (!Number.isFinite(amount) || amount < 0 || !validRates(rates)) return null;
  return { eur: amount / rates.mdlPerEur, usd: amount / rates.mdlPerUsd };
}
