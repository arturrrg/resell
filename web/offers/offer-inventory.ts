import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfferDraft } from "../../shared/offer-draft";
import type { ProfileOffer } from "../../server/profile-offers";
import { identity, mergeMonitoredOffers, type Device } from "../storage";
import { savedDrafts, watchOfferChanges, changeDraftState } from "./draft-store";
import { reconcileOfferDrafts } from "./draft-view";
import { inNativeApp, marketplaceProfile } from "./native";
import { includeExternalOffers, watchMonitorSettings } from "./monitor-settings";
import { confirmedUnavailableAdverts, publicationIsVisible } from "./publication-presence";
export function useOfferInventory(owner: string | null, devices: Device[], enabled: boolean, refreshInventory: () => Promise<void>) {
  const [drafts, setDrafts] = useState<OfferDraft[]>([]), [external, setExternal] = useState(false);
  const [monitorError, setMonitorError] = useState("");
  const [verifiedOwner, setVerifiedOwner] = useState<string | null>(null);
  const verified = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const live = useRef({ drafts, external, devices }); live.current = { drafts, external, devices };
  const objectUrls = useRef(new Map<Blob, string>());
  const photoLists = useRef(new WeakMap<OfferDraft["photos"], string[]>());
  useEffect(() => {
    const retained = new Set(drafts.flatMap(d => d.photos.map(p => p.blob)));
    for (const [blob, url] of objectUrls.current) if (!retained.has(blob)) { URL.revokeObjectURL(url); objectUrls.current.delete(blob); }
  }, [drafts]);
  const reload = useCallback(async () => {
    if (!owner) return;
    const items = await savedDrafts(owner, true);
    setDrafts(previous => reconcileOfferDrafts(previous, items));
  }, [owner]);
  useEffect(() => {
    setDrafts([]); setMonitorError("");
    if (!owner) return;
    let alive = true;
    const load = () => void savedDrafts(owner, true).then(items => { if (alive) setDrafts(previous => reconcileOfferDrafts(previous, items)); }).catch(() => {});
    load(); const stop = watchOfferChanges(owner, change => {
      if (!alive) return;
      if (change.draft) setDrafts(previous => reconcileOfferDrafts(previous, [change.draft!, ...previous.filter(d => d.id !== change.draft!.id)].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))));
      else if (change.removedId) setDrafts(previous => previous.filter(d => d.id !== change.removedId));
      else load();
    });
    const settings = () => { setExternal(includeExternalOffers(owner)); setRevision(v => v + 1); };
    setExternal(includeExternalOffers(owner));
    const stopSettings = watchMonitorSettings(owner, settings);
    return () => { alive = false; stop(); stopSettings(); for (const url of objectUrls.current.values()) URL.revokeObjectURL(url); objectUrls.current.clear(); };
  }, [owner]);
  // The timer is intentionally independent of tab navigation. No remount, image
  // reset, or whole-inventory busy state is needed during an update.
  useEffect(() => {
    if (!owner || !enabled || !inNativeApp()) return;
    const scope = owner;
    const controller = new AbortController();
    let running = false, checkAgain = false, last = 0, foreground = 0;
    async function check(wake = false) {
      const fresh = verified.current !== scope || wake;
      if (controller.signal.aborted || document.visibilityState === "hidden") return;
      if (running) { checkAgain ||= wake; return; }
      if (!fresh && Date.now() - last < 60000) return;
      const turn = foreground;
      running = true; last = Date.now();
      try {
        const base = (import.meta as any).env.VITE_API_BASE_URL || "";
        if (base && !base.startsWith("https://")) throw Error("Marketplace updates require HTTPS.");
        const [profile, drafts] = await Promise.all([
          marketplaceProfile(scope, !fresh),
          fresh ? savedDrafts(scope, true) : live.current.drafts,
        ]);
        const external = includeExternalOffers(scope), { devices } = live.current;
        const prepared = new Set(drafts.flatMap(d => d.publications?.map(p => p.advertId) || []));
        const byAdvert = new Map(devices.map(d => [identity(d.listingUrl || ""), d]));
        const checks = await Promise.allSettled(profile.accounts.map(async (account) => {
          const login = account.username || (!account.login.includes("@") ? account.login : "");
          if (!login || (!external && !drafts.some(d => d.publications?.some(p => p.accountId === account.id)))) return;
          const publishedIds = drafts.flatMap(d => (d.publications || []).filter(p => p.accountId === account.id && p.state === "published").map(p => p.advertId));
          const seen = new Set<string>(); let complete = false, expectedTotal = -1, consistent = true;
          for (let skip = 0; skip <= 20000; skip += 50) {
            const response = await fetch(base + "/api/profile-offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, skip, fresh }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
            const value = await response.json();
            if (!response.ok || !value.ok || !Array.isArray(value.offers) || !Number.isSafeInteger(value.total)) throw Error(value.error || "Could not update public offers.");
            const offers = value.offers as ProfileOffer[];
            for (const ad of offers) { if (!/^[1-9]\d{5,11}$/.test(ad.advertId) || ad.login.toLowerCase() !== login.toLowerCase()) throw Error("Invalid marketplace response."); seen.add(ad.advertId); }
            if (expectedTotal < 0) expectedTotal = value.total;
            else if (expectedTotal !== value.total) consistent = false;
            const lastPage = skip + 50 >= value.total;
            complete = lastPage && consistent && seen.size === value.total;
            controller.signal.throwIfAborted();
            let unavailableIds: ReadonlySet<string> | undefined;
            if (complete) {
              const candidates = new Set(publishedIds);
              for (const [id, device] of byAdvert) {
                if (id && device.monitoredAccount?.toLowerCase() === login.toLowerCase())
                  candidates.add(id);
              }
              const missing = [...candidates].filter(id => !seen.has(id) && publicationIsVisible(byAdvert.get(id)));
              if (missing.length)
                unavailableIds = await confirmedUnavailableAdverts(missing, base, controller.signal);
            }
            await mergeMonitoredOffers(scope, login, external ? offers : offers.filter(ad => prepared.has(ad.advertId)), complete, [...seen], publishedIds, unavailableIds);
            if (lastPage) break;
            if (controller.signal.aborted) return;
          }
        }));
        const failed = checks.find(result => result.status === "rejected");
        if (failed) throw failed.reason;
        if (!controller.signal.aborted) setMonitorError("");
      } catch (e) { if (!controller.signal.aborted) setMonitorError((e as Error).message); }
      finally {
        try {
          if (!controller.signal.aborted && turn === foreground && verified.current !== scope) {
            await refreshInventory();
            if (!controller.signal.aborted && turn === foreground) {
              verified.current = scope;
              setVerifiedOwner(scope);
            }
          }
        } catch (e) {
          if (!controller.signal.aborted) setMonitorError((e as Error).message);
        } finally {
          running = false;
          if (checkAgain) { checkAgain = false; void check(true); }
        }
      }
    }
    void check(); const timer = setInterval(() => void check(), 60000);
    const online = () => { void check(true); };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        foreground++;
        verified.current = null;
        setVerifiedOwner(null);
      } else void check(true);
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [owner, enabled, revision, refreshInventory, drafts.flatMap(d => d.publications?.map(p => p.advertId) || []).join(",")]);
  const view = useMemo(() => {
    const byAdvert = new Map(devices.map(d => [identity(d.listingUrl || ""), d]));
    const inventory = new Map<string, Device>(), soldAdverts = new Set<string>();
    const sales: Device[] = [];
    for (const draft of drafts) {
      if (draft.kind === "template") continue;
      if (draft.sale) {
        for (const p of draft.publications || []) soldAdverts.add(p.advertId);
        sales.push({ id: "offer-sale:" + draft.id, offerDraftId: draft.id, closedOffer: draft.sale.closed, model: draft.model, title: draft.title, saleStatus: "sold", soldAt: draft.sale.soldAt, soldProfit: draft.sale.profit, createdAt: draft.createdAt }); continue;
      }
      for (const p of draft.publications || []) {
        const source = byAdvert.get(p.advertId);
        if (!publicationIsVisible(source)) continue;
        const photos = () => { let list = photoLists.current.get(draft.photos); if (!list) { list = draft.photos.map(p => { let url = objectUrls.current.get(p.blob); if (!url) { url = URL.createObjectURL(p.blob); objectUrls.current.set(p.blob, url); } return url; }); photoLists.current.set(draft.photos, list); } return list; };
        inventory.set(p.advertId, source || { id: "offer:" + p.advertId, offerDraftId: draft.id, title: draft.title, model: draft.model, brand: draft.brand, storage: draft.storage, color: draft.color, condition: draft.condition, batteryHealth: draft.batteryHealth, sourcePrice: Number((p.price ?? draft.price).replace(",", ".")), currency: p.currency ?? draft.currency, listingDescription: draft.description, photos: photos(), listingUrl: "https://999.md/ro/" + p.advertId, sellerName: p.login, sourceAvailability: p.state === "submitted" ? "Under review" : "Available" });
      }
    }
    if (external) for (const d of devices) { const id = identity(d.listingUrl || ""); if (id && d.monitoredAccount && publicationIsVisible(d) && d.saleStatus !== "sold") inventory.set(id, d); }
    return { inventory: [...inventory].filter(([id]) => !soldAdverts.has(id)).map(([,d]) => d), sales: [...devices.filter(d => d.saleStatus === "sold"), ...sales] };
  }, [drafts, devices, external]);
  const undoSale = useCallback(async (device: Device) => {
    if (!owner || !device.offerDraftId) return;
    await changeDraftState(device.offerDraftId, owner, d => { const { sale, ...rest } = d; return rest; });
    await reload();
  }, [owner, reload]);
  const verifying = !!owner && enabled && inNativeApp() && verifiedOwner !== owner;
  return { ...view, drafts, external, verifying, undoSale, monitorError };
}
