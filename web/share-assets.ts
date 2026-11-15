import { viewLink, viewingCode } from "./sharing";
export type ShareAsset = { code: string; qr: string };
const assets = new Map<string, { value: ShareAsset; expires: number }>();
const pending = new Map<string, Promise<ShareAsset | null>>();
const epochs = new Map<string, number>();
export const shareAssetKey = (workspace: string, origin: string) =>
  workspace + "|" + new URL(origin).origin;
export function cachedShareAsset(key: string, now = Date.now()) {
  const item = assets.get(key);
  if (item && item.expires > now) return item.value;
  assets.delete(key);
  return undefined;
}
export function invalidateShareAsset(key: string) {
  assets.delete(key);
  epochs.set(key, (epochs.get(key) || 0) + 1);
  if (epochs.size > 32)
    for (const name of epochs.keys())
      if (
        !assets.has(name) &&
        ![...pending.keys()].some((job) => job.startsWith(name + "|"))
      ) {
        epochs.delete(name);
        if (epochs.size <= 32) break;
      }
}
export function prepareShareAsset(
  key: string,
  origin: string,
  fetchCode: () => Promise<string | null>,
  renderQR: (url: string) => Promise<string>,
  kind: "read" | "create" = "create",
) {
  const cached = cachedShareAsset(key);
  if (cached) return Promise.resolve(cached);
  const jobKey = key + "|" + kind;
  const running = pending.get(jobKey);
  if (running) return running;
  if (kind === "read" && pending.has(key + "|create"))
    return pending.get(key + "|create")!;
  if (kind === "create") epochs.set(key, (epochs.get(key) || 0) + 1);
  const epoch = epochs.get(key) || 0;
  const job = (async () => {
    const code = await fetchCode();
    if (!code) return null;
    if (!viewingCode(code)) throw Error("Could not create a viewing code.");
    const qr = await renderQR(viewLink(code, origin));
    if ((epochs.get(key) || 0) !== epoch) return null;
    const value = { code, qr };
    if (assets.size >= 8) assets.delete(assets.keys().next().value!);
    assets.set(key, { value, expires: Date.now() + 60000 });
    return value;
  })();
  pending.set(jobKey, job);
  void job.finally(() => pending.delete(jobKey)).catch(() => {});
  return job;
}
