import type { Device } from "./storage";
export const SALE_UNDO_MS = 5000;
export function saleTime(device: Device) {
  const time = Date.parse(
    device.soldAt || (device.updatedAt as string) || device.createdAt || "",
  );
  return Number.isFinite(time) ? time : 0;
}
export function archivedSale(device: Device, now = Date.now()) {
  return device.saleStatus === "sold" && now - saleTime(device) >= SALE_UNDO_MS;
}
export function salesSummary(devices: Device[]) {
  const sold = devices
    .filter((d) => d.saleStatus === "sold")
    .sort((a, b) => saleTime(a) - saleTime(b));
  const known = sold.filter((d) =>
    Number.isFinite(d.soldProfit ?? d.expectedProfit),
  );
  const total = known.reduce(
    (sum, d) => sum + (d.soldProfit ?? d.expectedProfit ?? 0),
    0,
  );
  const months = new Map<string, number>();
  for (const d of known) {
    const time = saleTime(d);
    if (!time) continue;
    const key = new Date(time).toLocaleDateString("sv-SE").slice(0, 7);
    months.set(
      key,
      (months.get(key) || 0) + (d.soldProfit ?? d.expectedProfit ?? 0),
    );
  }
  return {
    sold,
    known,
    total,
    months: [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6),
  };
}
