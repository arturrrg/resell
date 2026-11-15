import type { Device } from "../web/storage";
export const SOURCE_REFRESH_INTERVAL = 15 * 60_000;
export const SOURCE_REQUEST_GAP = 5_000;
export function sourceIsDue(device: Device, now: number) {
  const checked = Date.parse(device.sourceCheckedAt || "");
  const retry = Date.parse(device.sourceRefreshRetryAt || "");
  if (Number.isFinite(retry) && retry > now && retry <= now + 60 * 60_000)
    return false;
  if (device.sourceRefreshError && (!Number.isFinite(retry) || retry <= now))
    return true;
  return (
    !Number.isFinite(checked) ||
    checked > now + SOURCE_REFRESH_INTERVAL ||
    now - checked >= SOURCE_REFRESH_INTERVAL
  );
}
export function sourceRetryDelay(
  failures: number,
  unavailable = false,
  restricted = false,
) {
  return unavailable
    ? 60 * 60_000
    : restricted
      ? Math.min(
          60 * 60_000,
          5 * 60_000 * 2 ** Math.min(4, Math.max(0, failures - 1)),
        )
      : Math.min(
          5 * 60_000,
          60_000 * 2 ** Math.min(3, Math.max(0, failures - 1)),
        );
}
