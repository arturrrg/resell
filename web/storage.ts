import {
  sourceIsDue,
  sourceRetryDelay,
  SOURCE_REQUEST_GAP,
} from "../shared/refresh";
import { profileAbsences } from "./offers/publication-presence";
export const INVENTORY_CHANGED = "resell-inventory-changed";
let broadcast: BroadcastChannel | undefined;
function changesChannel() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof BroadcastChannel === "undefined"
  )
    return;
  if (!broadcast) {
    try {
      broadcast = new BroadcastChannel("resell.inventory.v1");
    } catch {
      return;
    }
    broadcast.onmessage = (event) => {
      if (typeof event.data === "string")
        window.dispatchEvent(
          new CustomEvent(INVENTORY_CHANGED, { detail: event.data }),
        );
    };
  }
  return broadcast;
}
export function watchInventoryChanges(listener: (database: string) => void) {
  changesChannel();
  const handle = (event: Event) =>
    listener((event as CustomEvent<string>).detail);
  window.addEventListener(INVENTORY_CHANGED, handle);
  return () => window.removeEventListener(INVENTORY_CHANGED, handle);
}
function inventoryChanged(db: IDBDatabase) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(INVENTORY_CHANGED, { detail: db.name }),
    );
  } catch {}
  try {
    changesChannel()?.postMessage(db.name);
  } catch {}
}
export type Video = {
  url: string;
  embedUrl?: string;
  poster?: string;
  kind: "embed" | "video";
};
export type Device = {
  monitoredAccount?: string;
  monitorActive?: boolean;
  offerDraftId?: string;
  closedOffer?: boolean;
  saleStatus?: "in_progress" | "sold";
  expectedProfit?: number;
  soldAt?: string;
  soldProfit?: number;
  sourceCheckedAt?: string;
  sourceLastFailure?: string;
  sourceLastFailureAt?: string;
  sourceRefreshError?: string;
  sourceRefreshRetryAt?: string;
  sourceRefreshFailures?: number;
  sellerName?: string;
  sellerUrl?: string;
  characteristics?: { label: string; value: string }[];
  videos?: Video[];
  id: string;
  brand?: string;
  model?: string;
  title?: string;
  storage?: string;
  color?: string;
  condition?: string;
  batteryHealth?: number | string;
  askingPrice?: number;
  myPrice?: number;
  sourcePrice?: number;
  currency?: string;
  availability?: string;
  listingUrl?: string;
  listingDescription?: string;
  photos?: string[];
  createdAt?: string;
  source?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  [key: string]: unknown;
};
export function identity(value: string) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      !["999.md", "www.999.md", "new.999.md"].includes(u.hostname) ||
      u.username ||
      u.password ||
      u.port
    )
      return "";
    return u.pathname.match(/^\/(?:ro|ru|en)\/(\d+)\/?$/)?.[1] || "";
  } catch {
    return "";
  }
}
export async function mergeMonitoredOffers(owner: string, login: string, offers: import("../server/profile-offers").ProfileOffer[], complete: boolean, seenIds: string[], publishedIds: string[] = []) {
  const db = await databaseForOwner(owner);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["devices", "meta"], "readwrite");
    const store = tx.objectStore("devices"), meta = tx.objectStore("meta");
    const account = login.toLowerCase(), monitorId = "monitor:" + account;
    const previousCheck = meta.get(monitorId), request = store.getAll();
    let changed = false;
    request.onsuccess = () => {
      const existing = request.result as Device[], byAdvert = new Map(existing.map(d => [identity(d.listingUrl || ""), d]));
      for (const ad of offers) {
        const old = byAdvert.get(ad.advertId);
        const next: Device = { ...old, id: old?.id || crypto.randomUUID(), createdAt: old?.createdAt || new Date().toISOString(), title: ad.title, listingUrl: "https://999.md/ro/" + ad.advertId, sellerName: ad.login, sellerUrl: "https://999.md/ro/profile/" + encodeURIComponent(ad.login), monitoredAccount: login, monitorActive: true };
        next.sourcePrice = ad.price;
        next.currency = ad.currency;
        next.sourceAvailability = "Available";
        const imageIds = (values?: string[]) => (values || []).map(url => url.split("/").at(-1)?.split("?")[0]).join("|");
        if (!old?.photos?.length || imageIds(old.photos) !== imageIds(ad.photos)) next.photos = ad.photos;
        if (JSON.stringify(old) !== JSON.stringify(next)) { store.put(next); changed = true; }
      }
      const seen = new Set(seenIds);
      const previous: [string, number][] = previousCheck.result?.missing || [];
      if (complete) {
        const candidates = new Set(publishedIds);
        for (const d of existing) {
          if (d.monitoredAccount?.toLowerCase() === account) candidates.add(identity(d.listingUrl || ""));
        }
        const checkedAt = Date.now();
        const { pending, confirmed } = profileAbsences(candidates, seen, previous, checkedAt);
        for (const id of confirmed) {
          if (!/^[1-9]\d{5,11}$/.test(id)) continue;
          const old = byAdvert.get(id);
          if (old?.monitoredAccount && old.monitoredAccount.toLowerCase() !== account) continue;
          if (old?.monitorActive === false) continue;
          store.put({ ...old, id: old?.id || crypto.randomUUID(), createdAt: old?.createdAt || new Date().toISOString(), listingUrl: "https://999.md/ro/" + id, monitoredAccount: login, monitorActive: false });
          changed = true;
        }
        meta.put({ id: monitorId, checkedAt: new Date(checkedAt).toISOString(), missing: pending });
      } else {
        const pending = previous.filter(([id]) => !seen.has(id));
        if (pending.length !== previous.length) meta.put({ ...previousCheck.result, missing: pending });
      }
    };
    tx.oncomplete = () => { if (changed) inventoryChanged(db); resolve(); };
    tx.onerror = tx.onabort = () => reject(tx.error || Error("Could not save monitored offers."));
  });
}
let activeOwner: string | null = null;
const openings = new Map<string, Promise<IDBDatabase>>();
export function activateOwner(owner: string | null) {
  activeOwner = owner;
}
export function databaseForOwner(owner: string | null) {
  const name = "maison-reseller-workspace" + (owner ? `--${owner}` : "");
  if (openings.has(name)) return openings.get(name)!;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(name, 2);
    r.onupgradeneeded = () => {
      for (const name of ["devices", "offers", "recovery", "meta"])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: "id" });
      const tx = r.transaction!;
      const devices = tx.objectStore("devices");
      const d = devices.getAll(),
        o = tx.objectStore("offers").getAll();
      o.onsuccess = () => {
        tx.objectStore("recovery").put({
          id: "original-migration",
          format: "resell-backup",
          version: 1,
          devices: d.result,
          offers: o.result,
        });
        for (const item of d.result) {
          item.myPrice ??= item.askingPrice;
          item.overrides ||= item.source
            ? Object.fromEntries(
                Object.keys(item.source)
                  .filter((k) => item[k] !== item.source[k])
                  .map((k) => [k, item[k]]),
              )
            : {};
          devices.put(item);
        }
        tx.objectStore("meta").put({
          id: "schema",
          version: 2,
          migratedAt: new Date().toISOString(),
        });
      };
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error("Close other inventory tabs and retry."));
  });
  openings.set(name, opening);
  return opening;
}
export function database() {
  return databaseForOwner(activeOwner);
}
export async function transaction(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => void,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("devices", mode);
    try {
      run(tx.objectStore("devices"));
    } catch (e) {
      tx.abort();
      reject(e);
    }
    tx.oncomplete = () => {
      if (mode === "readwrite") inventoryChanged(db);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function all() {
  const db = await database();
  return new Promise<Device[]>((resolve, reject) => {
    const r = db.transaction("devices").objectStore("devices").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function snapshot() {
  const db = await database();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(["devices", "offers"], "readonly");
    const d = tx.objectStore("devices").getAll(),
      o = tx.objectStore("offers").getAll();
    tx.oncomplete = () =>
      resolve({
        format: "resell-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        devices: d.result,
        offers: o.result,
      });
    tx.onerror = () => reject(tx.error);
  });
}
export function validateBackup(data: any) {
  if (
    !data ||
    !["resell-backup", "veyra-backup", "maison-workspace-backup"].includes(
      data.format,
    ) ||
    data.version !== 1 ||
    !Array.isArray(data.devices) ||
    !Array.isArray(data.offers)
  )
    throw Error("Unsupported backup.");
  const ids = new Set();
  for (const d of data.devices) {
    if (
      !d ||
      typeof d.id !== "string" ||
      !d.id ||
      ids.has(d.id) ||
      (d.photos && !Array.isArray(d.photos)) ||
      d.photos?.some((x: unknown) => typeof x !== "string")
    )
      throw Error("Invalid device records.");
    ids.add(d.id);
    if (d.saleStatus != null && !["in_progress", "sold"].includes(d.saleStatus))
      throw Error("Invalid sale status.");
    for (const key of [
      "myPrice",
      "sourcePrice",
      "askingPrice",
      "expectedProfit",
      "soldProfit",
    ])
      if (d[key] != null && (!Number.isFinite(d[key]) || d[key] < 0))
        throw Error("Invalid price.");
  }
  return data;
}
export async function restoreBackup(data: any) {
  validateBackup(data);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["devices", "offers", "recovery"], "readwrite");
    const devices = tx.objectStore("devices"),
      offers = tx.objectStore("offers");
    const d = devices.getAll(),
      o = offers.getAll();
    o.onsuccess = () => {
      tx.objectStore("recovery").put({
        id: "before-restore",
        format: "resell-backup",
        version: 1,
        devices: d.result,
        offers: o.result,
      });
      devices.clear();
      offers.clear();
      for (const item of data.devices) devices.put(item);
      for (const item of data.offers) offers.put(item);
    };
    tx.oncomplete = () => {
      inventoryChanged(db);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function recover() {
  const db = await database();
  const data = await new Promise<any>((resolve, reject) => {
    const r = db
      .transaction("recovery")
      .objectStore("recovery")
      .get("before-restore");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  if (!data) throw Error("No previous restore to recover.");
  await restoreBackup(data);
}
export async function saveSaleDetails(
  id: string,
  saleStatus: "in_progress" | "sold",
  expectedProfit?: number,
) {
  if (
    !["in_progress", "sold"].includes(saleStatus) ||
    (expectedProfit !== undefined &&
      (!Number.isFinite(expectedProfit) || expectedProfit < 0))
  )
    throw Error("Enter a valid profit amount.");
  await transaction("readwrite", (store) => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) return;
      store.put({
        ...request.result,
        saleStatus,
        expectedProfit,
        soldAt:
          saleStatus === "sold"
            ? request.result.soldAt || new Date().toISOString()
            : undefined,
        soldProfit: saleStatus === "sold" ? expectedProfit : undefined,
        updatedAt: new Date().toISOString(),
      });
    };
  });
}
export async function commitImport(listing: any, refreshId?: string) {
  const db = await database();
  return new Promise<boolean>((resolve, reject) => {
    let written = false;
    const tx = db.transaction("devices", "readwrite"),
      store = tx.objectStore("devices");
    const r = store.getAll();
    r.onsuccess = () => {
      const previous = (r.result as Device[]).find((d) =>
        refreshId
          ? d.id === refreshId
          : identity(d.listingUrl || "") === identity(listing.url),
      );
      // A refresh finishing after deletion must not recreate the device.
      if (refreshId && !previous) return;
      const source = {
        sellerName: listing.sellerName || "",
        sellerUrl: listing.sellerUrl || "",
        deviceType: listing.deviceType,
        modelGeneration: listing.modelGeneration,
        brand: listing.brand,
        model: listing.model,
        title: listing.title,
        storage: listing.storage,
        color: listing.color,
        condition: listing.condition,
        batteryHealth: listing.batteryHealth,
        accessories: listing.accessories,
        warranty: listing.warranty,
        batteryCapacityMah: listing.batteryCapacityMah,
        category: listing.category,
      };
      const overrides = previous?.overrides || {};
      store.put({
        ...previous,
        ...source,
        sourcePrice: listing.price,
        currency: listing.currency,
        listingDescription: listing.description,
        photos: listing.images,
        videos: listing.videos || [],
        sourceAvailability: listing.availability,
        rawCharacteristics: listing.rawCharacteristics,
        characteristics: listing.characteristics || [],
        ...overrides,
        id: previous?.id || crypto.randomUUID(),
        source,
        overrides,
        listingUrl: listing.url,
        availability: previous?.availability || "available",
        createdAt: previous?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceCheckedAt: new Date().toISOString(),
        sourceLastFailure: previous?.sourceRefreshError || previous?.sourceLastFailure || "",
        sourceLastFailureAt: previous?.sourceLastFailureAt || "",
        sourceRefreshError: "",
        sourceRefreshRetryAt: "",
        sourceRefreshFailures: 0,
      });
      written = true;
    };
    tx.oncomplete = () => {
      if (written) inventoryChanged(db);
      resolve(written);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function claimSourceRefresh(id: string, now: number) {
  const db = await database();
  return new Promise<Device | null>((resolve, reject) => {
    let claimed: Device | null = null;
    const tx = db.transaction(["devices", "meta"], "readwrite"),
      meta = tx.objectStore("meta");
    const slot = meta.get("source-refresh-slot"),
      lease = meta.get("source-refresh-lease:" + id),
      device = tx.objectStore("devices").get(id);
    device.onsuccess = () => {
      const d = device.result as Device | undefined;
      if (
        !d ||
        !identity(d.listingUrl || "") ||
        !sourceIsDue(d, now) ||
        (slot.result?.nextAt || 0) > now ||
        (lease.result?.nextAt || 0) > now
      )
        return;
      meta.put({ id: "source-refresh-slot", nextAt: now + SOURCE_REQUEST_GAP });
      meta.put({ id: "source-refresh-lease:" + id, nextAt: now + 60_000 });
      claimed = d;
    };
    tx.oncomplete = () => resolve(claimed);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function recordSourceFailure(
  db: IDBDatabase,
  id: string,
  message: string,
  now = Date.now(),
) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["devices", "meta"], "readwrite"),
      store = tx.objectStore("devices"),
      r = store.get(id);
    let written = false;
    r.onsuccess = () => {
      const d = r.result as Device | undefined;
      if (!d) return;
      const failures = (d.sourceRefreshFailures || 0) + 1,
        unavailable = /advert could not be found/i.test(message),
        restricted = /too many imports|declined|browser verification/i.test(message);
      store.put({
        ...d,
        sourceRefreshError: message,
        sourceLastFailure: message,
        sourceLastFailureAt: new Date(now).toISOString(),
        sourceRefreshFailures: failures,
        sourceRefreshRetryAt: new Date(
          now + sourceRetryDelay(failures, unavailable, restricted),
        ).toISOString(),
        ...(unavailable && !d.monitoredAccount ? { sourceAvailability: "unavailable" } : {}),
      });
      written = true;
      tx.objectStore('meta').delete('source-refresh-lease:'+id);
      if (restricted)
        tx.objectStore("meta").put({
          id: "source-refresh-slot",
          nextAt: now + 5 * 60_000,
        });
    };
    tx.oncomplete = () => {
      if (written) inventoryChanged(db);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
