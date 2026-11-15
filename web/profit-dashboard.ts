import type { Device } from "./storage";
import { saleTime } from "./sales";
export type ProfitRange = "30d" | "90d" | "all";
export function profitDashboard(
  devices: Device[],
  range: ProfitRange,
  now = Date.now(),
) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const start =
    range === "all"
      ? 0
      : today.getTime() - (range === "30d" ? 29 : 89) * 86400000;
  const sold = devices
    .filter(
      (d) =>
        d.saleStatus === "sold" && saleTime(d) >= start && saleTime(d) <= now,
    )
    .sort((a, b) => saleTime(b) - saleTime(a));
  const known = sold.filter((d) =>
    Number.isFinite(d.soldProfit ?? d.expectedProfit),
  );
  const total = known.reduce(
    (n, d) => n + (d.soldProfit ?? d.expectedProfit ?? 0),
    0,
  );
  const pipeline = devices
    .filter((d) => d.saleStatus !== "sold")
    .reduce(
      (n, d) => n + (Number.isFinite(d.expectedProfit) ? d.expectedProfit! : 0),
      0,
    );
  const buckets = new Map<string, number>();
  const monthly = range === "all";
  const cursor = new Date(
    start ||
      Math.max(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 23, 1),
        known.length ? Math.min(...known.map(saleTime)) : now,
      ),
  );
  if (monthly) cursor.setUTCDate(1);
  for (let i = 0; cursor.getTime() <= now && i < 100; i++) {
    const key = cursor.toISOString().slice(0, monthly ? 7 : 10);
    buckets.set(key, 0);
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const d of known) {
    const key = new Date(saleTime(d)).toISOString().slice(0, monthly ? 7 : 10);
    if (buckets.has(key))
      buckets.set(
        key,
        buckets.get(key)! + (d.soldProfit ?? d.expectedProfit ?? 0),
      );
  }
  return {
    sold,
    total,
    best: known.length ? Math.max(...known.map(d => d.soldProfit ?? d.expectedProfit ?? 0)) : 0,
    pipeline,
    known: known.length,
    missing: sold.length - known.length,
    average: known.length ? total / known.length : 0,
    monthly,
    points: [...buckets].map(([date, value]) => ({ date, value })),
  };
}
