const eventName = "resell-monitor-setting";
const key = (owner: string) => "resell-monitor-external-v1:" + owner;
export function includeExternalOffers(owner: string) {
  try { return localStorage.getItem(key(owner)) === "true"; } catch { return false; }
}
export function setIncludeExternalOffers(owner: string, value: boolean) {
  localStorage.setItem(key(owner), String(value));
  window.dispatchEvent(new CustomEvent(eventName, { detail: owner }));
}
export function watchMonitorSettings(owner: string, onChange: () => void) {
  const changed = (e: Event) => { if ((e as CustomEvent).detail === owner) onChange(); };
  const storage = (e: StorageEvent) => { if (e.key === key(owner)) onChange(); };
  window.addEventListener(eventName, changed); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(eventName, changed); window.removeEventListener("storage", storage); };
}
