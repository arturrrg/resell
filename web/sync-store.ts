import { databaseForOwner, identity, type Device } from "./storage";

export type CloudRow = {
  record_key: string;
  payload: Device | null;
  deleted: boolean;
  content_hash: string;
  version?: number;
};
export type SyncState = {
  id: string;
  initialized: boolean;
  baseline: Record<string, string>;
};
export const recordKey = (device: Device) =>
  identity(device.listingUrl || "")
    ? `999:${identity(device.listingUrl || "")}`
    : `legacy:${device.id}`;
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export async function deviceHash(value: Device) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(value)),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashedDevices(devices: Device[]) {
  return new Map(
    await Promise.all(
      devices.map(
        async (device) =>
          [
            recordKey(device),
            { device, hash: await deviceHash(device) },
          ] as const,
      ),
    ),
  );
}
export function pendingChanges(
  local: Awaited<ReturnType<typeof hashedDevices>>,
  state: SyncState,
  remote: CloudRow[],
) {
  const server = new Map(remote.map((row) => [row.record_key, row]));
  const changes: CloudRow[] = [];
  for (const [key, { device, hash }] of local) {
    // On a first connection, existing cloud records (including tombstones) win.
    // The untouched local seed remains recoverable in its original database.
    if (!state.initialized && server.has(key)) continue;
    if (hash !== state.baseline[key])
      changes.push({
        record_key: key,
        payload: device,
        deleted: false,
        content_hash: hash,
      });
  }
  if (state.initialized)
    for (const [key, hash] of Object.entries(state.baseline)) {
      if (hash !== "deleted" && !local.has(key))
        changes.push({
          record_key: key,
          payload: null,
          deleted: true,
          content_hash: "deleted",
        });
    }
  return changes;
}
export function readStore<T>(
  db: IDBDatabase,
  store: string,
  key?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store),
      request =
        key === undefined
          ? tx.objectStore(store).getAll()
          : tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function completed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || Error("Local sync transaction was cancelled."));
  });
}
export async function seedAccount(owner: string) {
  const local = await databaseForOwner(null),
    account = await databaseForOwner(owner);
  if (await readStore(account, "meta", "local-seed")) return account;
  const claimed = await readStore<{ owner: string } | undefined>(
    local,
    "meta",
    "cloud-claimed-by",
  );
  const source =
    !claimed || claimed.owner === owner
      ? await readStore<Device[]>(local, "devices")
      : [];
  const existing = await readStore<Device[]>(account, "devices");
  const keys = new Set(existing.map(recordKey));
  const tx = account.transaction(["devices", "meta", "recovery"], "readwrite"),
    done = completed(tx);
  for (const device of source)
    if (!keys.has(recordKey(device))) tx.objectStore("devices").put(device);
  tx.objectStore("recovery").put({
    id: "before-cloud",
    format: "resell-backup",
    version: 1,
    devices: source,
    offers: [],
  });
  tx.objectStore("meta").put({
    id: "local-seed",
    at: new Date().toISOString(),
  });
  await done;
  if (!claimed && source.length) {
    const mark = local.transaction("meta", "readwrite"),
      marked = completed(mark);
    mark.objectStore("meta").put({ id: "cloud-claimed-by", owner });
    await marked;
  }
  return account;
}
export async function mergeCloud(
  db: IDBDatabase,
  before: Awaited<ReturnType<typeof hashedDevices>>,
  remote: CloudRow[],
) {
  // Hash first, then re-read inside the write transaction. Edits made while a
  // network request or hash was pending must stay queued, never be overwritten.
  const read = await readStore<Device[]>(db, "devices"),
    now = await hashedDevices(read);
  const tx = db.transaction(["devices", "meta", "recovery"], "readwrite"),
    done = completed(tx),
    store = tx.objectStore("devices");
  const req = store.getAll();
  req.onsuccess = () => {
    const latest = new Map(
      (req.result as Device[]).map((d) => [recordKey(d), d]),
    );
    let changed = false;
    const baseline: Record<string, string> = {};
    for (const row of remote) {
      baseline[row.record_key] = row.deleted ? "deleted" : row.content_hash;
      const current = latest.get(row.record_key),
        known = now.get(row.record_key),
        original = before.get(row.record_key);
      if (
        (current ? stableJson(current) : undefined) !==
        (known ? stableJson(known.device) : undefined)
      )
        continue;
      if (known?.hash !== original?.hash && known?.hash !== row.content_hash)
        continue;
      if (current && (row.deleted || current.id !== row.payload?.id)) {
        store.delete(current.id);
        changed = true;
      }
      if (
        !row.deleted &&
        row.payload &&
        stableJson(current) !== stableJson(row.payload)
      ) {
        store.put(row.payload);
        changed = true;
      }
    }
    if (changed) {
      const recovery = tx.objectStore("recovery");
      const snapshot = {
        id: "before-cloud-merge",
        format: "resell-backup",
        version: 1,
        devices: req.result,
        offers: [],
        exportedAt: new Date().toISOString(),
      };
      recovery.put(snapshot);
      recovery.put({
        ...snapshot,
        id: `cloud-merge:${snapshot.exportedAt}:${crypto.randomUUID()}`,
      });
      const keys = recovery.getAllKeys();
      keys.onsuccess = () => {
        const archives = keys.result
          .filter((key) => String(key).startsWith("cloud-merge:"))
          .sort();
        for (const key of archives.slice(0, Math.max(0, archives.length - 3)))
          recovery.delete(key);
      };
    }
    tx.objectStore("meta").put({
      id: "cloud-state",
      initialized: true,
      baseline,
    } satisfies SyncState);
  };
  await done;
}
export function reconcileDevices(previous: Device[], incoming: Device[]) {
  const old = new Map(previous.map((d) => [d.id, d]));
  return incoming.map((d) => {
    const before = old.get(d.id);
    if (!before) return d;
    if (stableJson(before) === stableJson(d)) return before;
    // Updating source timestamps or prices must not reset a gallery or restart
    // its preloaded players when their media has not changed.
    return {
      ...d,
      photos:
        stableJson(before.photos) === stableJson(d.photos)
          ? before.photos
          : d.photos,
      videos:
        stableJson(before.videos) === stableJson(d.videos)
          ? before.videos
          : d.videos,
      characteristics:
        stableJson(before.characteristics) === stableJson(d.characteristics)
          ? before.characteristics
          : d.characteristics,
    };
  });
}
