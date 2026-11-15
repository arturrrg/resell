import type { OfferDraft } from "../../shared/offer-draft";
import { offerState, templateFields } from "../../shared/offer-state";
import { newOffer } from "../../shared/offer-draft";
const openings = new Map<string, Promise<IDBDatabase>>();
const CHANGE = "resell-offers-changed";
export type OfferChange = { draft?: OfferDraft; removedId?: string };
let channel: BroadcastChannel | undefined;
function changed(scope: string, change: OfferChange = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: { scope, ...change } }));
  channel?.postMessage(scope);
}
export function watchOfferChanges(scope: string, listener: (change: OfferChange) => void) {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANGE);
    channel.onmessage = e => window.dispatchEvent(new CustomEvent(CHANGE, { detail: e.data }));
  }
  const handle = (e: Event) => { const detail = (e as CustomEvent).detail; if (detail === scope) listener({}); else if (detail?.scope === scope) listener(detail); };
  window.addEventListener(CHANGE, handle);
  return () => window.removeEventListener(CHANGE, handle);
}
export type OfferSyncMeta = {
  id: string;
  revision: number;
  fingerprint?: string;
  dirty?: boolean;
  deleted?: boolean;
  paths?: string[];
  cleanup?: string[];
};
function database(scope = "sandbox") {
  const NAME =
    scope === "sandbox"
      ? "resell-offer-sandbox-v1"
      : `resell-offers-v1--${encodeURIComponent(scope)}`;
  if (openings.has(NAME)) return openings.get(NAME)!;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("drafts"))
        request.result.createObjectStore("drafts", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains("sync"))
        request.result.createObjectStore("sync", { keyPath: "id" });
      const tx = request.transaction!, cursor = tx.objectStore("drafts").openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        const draft = entry.value as OfferDraft;
        if (draft.kind === "template" && draft.photos.length) {
          entry.update({ ...templateFields(draft), updatedAt: new Date(Math.max(Date.now(), Date.parse(draft.updatedAt) + 1 || 0)).toISOString() });
          const meta = tx.objectStore("sync").get(draft.id);
          meta.onsuccess = () => tx.objectStore("sync").put({ ...meta.result, id: draft.id, revision: meta.result?.revision || 0, dirty: true, deleted: false });
        }
        entry.continue();
      };
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        openings.delete(NAME);
      };
      resolve(request.result);
    };
    request.onerror = () => {
      openings.delete(NAME);
      reject(request.error);
    };
    request.onblocked = () => {
      openings.delete(NAME);
      reject(Error("Close other offer-sandbox tabs, then retry."));
    };
  });
  openings.set(NAME, opening);
  return opening;
}
export async function saveDraft(
  draft: OfferDraft,
  scope = "sandbox",
): Promise<void> {
  draft = templateFields(draft);
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["drafts", "sync"], "readwrite");
    tx.objectStore("drafts").put(draft);
    const meta = tx.objectStore("sync").get(draft.id);
    meta.onsuccess = () =>
      tx
        .objectStore("sync")
        .put({
          ...meta.result,
          id: draft.id,
          revision: meta.result?.revision || 0,
          dirty: true,
          deleted: false,
        });
    tx.oncomplete = () => { changed(scope, { draft }); resolve(); };
    tx.onerror = () => reject(tx.error || Error("Draft could not be saved."));
    tx.onabort = () => reject(tx.error || Error("Draft save was interrupted."));
  });
}
export async function savedDrafts(scope = "sandbox", includeClosedSales = false): Promise<OfferDraft[]> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    const request = tx.objectStore("drafts").getAll();
    tx.oncomplete = () =>
      resolve(
        (request.result as OfferDraft[])
          .filter((d) => d.version === 1 && (includeClosedSales || !d.sale?.closed))
          .map((d) => ({ ...d, secondaryTitle: d.secondaryTitle || "" }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    tx.onerror = () => reject(tx.error);
  });
}
export async function removeDraft(id: string, scope: string): Promise<void> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["drafts", "sync"], "readwrite");
    tx.objectStore("drafts").delete(id);
    const meta = tx.objectStore("sync").get(id);
    meta.onsuccess = () =>
      tx
        .objectStore("sync")
        .put({
          ...meta.result,
          id,
          revision: meta.result?.revision || 0,
          dirty: true,
          deleted: true,
        });
    tx.oncomplete = () => { changed(scope, { removedId: id }); resolve(); };
    tx.onerror = tx.onabort = () =>
      reject(tx.error || Error("Draft could not be removed."));
  });
}

/** Atomically archive only sale metadata and remove the original editable draft/photos. */
export async function closeDisappearedDraft(id: string, scope: string, profit: number): Promise<OfferDraft> {
  if (!Number.isFinite(profit) || profit < 0 || profit > 1e9) throw Error("Enter a valid profit amount.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope + ":closed-offer:" + id))).slice(0, 16);
  digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
  const hex = Array.from(digest, n => n.toString(16).padStart(2, "0")).join("");
  const archiveId = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["drafts", "sync"], "readwrite"), drafts = tx.objectStore("drafts"), sync = tx.objectStore("sync");
    let result: OfferDraft, failure: unknown;
    const original = drafts.get(id);
    original.onsuccess = () => {
      const archived = drafts.get(archiveId);
      archived.onsuccess = () => {
        try {
          const draft = original.result as OfferDraft | undefined;
          if (!draft) {
            if (archived.result?.sale?.closed) { result = archived.result; return; }
            throw Error("This draft is no longer available.");
          }
          if (draft.kind === "template" || draft.sale || !draft.publications?.length) throw Error("This draft has no marketplace publication to close.");
          const now = new Date().toISOString();
          result = archived.result || { ...newOffer(), id: archiveId, title: draft.title, brand: draft.brand, model: draft.model, storage: draft.storage, currency: draft.currency, price: draft.price, createdAt: draft.createdAt, updatedAt: now, publications: draft.publications, photos: [], sale: { profit, soldAt: now, closed: true, sourceDraftId: id } };
          offerState(result);
          drafts.put(result); drafts.delete(id);
          for (const [key, deleted] of [[id, true], [archiveId, false]] as const) {
            const meta = sync.get(key);
            meta.onsuccess = () => sync.put({ ...meta.result, id: key, revision: meta.result?.revision || 0, dirty: true, deleted });
          }
        } catch (error) { failure = error; tx.abort(); }
      };
    };
    tx.oncomplete = () => { changed(scope, { removedId: id }); changed(scope); resolve(result); };
    tx.onerror = tx.onabort = () => reject(failure || tx.error || Error("Could not close the offer. Your draft was kept."));
  });
}
export async function changeDraftState(
  id: string,
  scope: string,
  change: (draft: OfferDraft) => OfferDraft,
): Promise<OfferDraft> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["drafts", "sync"], "readwrite");
    let result: OfferDraft, failure: unknown;
    const request = tx.objectStore("drafts").get(id);
    request.onsuccess = () => {
      try {
        if (!request.result) throw Error("This offer is no longer available.");
        result = templateFields(change(request.result));
        offerState(result);
        result.updatedAt = new Date(Math.max(Date.now(), (Date.parse(request.result.updatedAt) || 0) + 1)).toISOString();
        tx.objectStore("drafts").put(result);
        const meta = tx.objectStore("sync").get(id);
        meta.onsuccess = () => tx.objectStore("sync").put({ ...meta.result, id, revision: meta.result?.revision || 0, dirty: true, deleted: false });
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { changed(scope, { draft: result }); resolve(result); };
    tx.onerror = tx.onabort = () => reject(failure || tx.error || Error("Could not save the offer change."));
  });
}
export async function offerSyncMetadata(
  scope: string,
): Promise<OfferSyncMeta[]> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync");
    const request = tx.objectStore("sync").getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearOfferCleanup(
  scope: string,
  id: string,
  paths: string[],
): Promise<void> {
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync", "readwrite"),
      store = tx.objectStore("sync"),
      request = store.get(id);
    request.onsuccess = () => {
      if (request.result)
        store.put({
          ...request.result,
          cleanup: (request.result.cleanup || []).filter(
            (path: string) => !paths.includes(path),
          ),
        });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function acceptCloudDraft(
  scope: string,
  draft: OfferDraft | null,
  meta: OfferSyncMeta,
  expectedLocalUpdatedAt?: string | null,
): Promise<void> {
  if (draft?.kind === "template" && draft.photos.length) {
    draft = templateFields(draft);
    meta = { ...meta, dirty: true };
  }
  const db = await database(scope);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["drafts", "sync"], "readwrite"),
      records = tx.objectStore("drafts"),
      current = records.get(meta.id);
    current.onsuccess = () => {
      if (
        expectedLocalUpdatedAt !== undefined &&
        (current.result?.updatedAt || null) !== expectedLocalUpdatedAt
      ) {
        const latest = tx.objectStore("sync").get(meta.id);
        latest.onsuccess = () =>
          tx
            .objectStore("sync")
            .put({
              ...meta,
              dirty: true,
              deleted: latest.result?.deleted || false,
            });
      } else {
        if (draft) records.put(draft);
        else if (meta.deleted) records.delete(meta.id);
        tx.objectStore("sync").put(meta);
      }
    };
    tx.oncomplete = () => { if (draft || meta.deleted) changed(scope); resolve(); };
    tx.onerror = tx.onabort = () =>
      reject(tx.error || Error("Could not commit the synced draft."));
  });
}
