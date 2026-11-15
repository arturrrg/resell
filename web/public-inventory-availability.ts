import type { PublicInventoryItem } from "./public-inventory-model";

/** Verify against complete public account feeds, even while the owner's app is closed. */
export async function availablePublicInventory(items: PublicInventoryItem[], signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const accounts = [...new Set(items.map(item => item.seller).filter(login => /^[\p{L}\p{N}_.+-]{1,60}$/u.test(login)))];
  const active = new Map<string, Set<string>>();
  const base = (import.meta as any).env?.VITE_API_BASE_URL || "";
  if (base && !base.startsWith("https://")) throw Error("Inventory updates require HTTPS.");
  // Keep concurrency bounded for inventories shared from several accounts.
  for (let start = 0; start < accounts.length; start += 3) {
    await Promise.all(accounts.slice(start, start + 3).map(async login => {
      const seen = new Set<string>(); let expected = -1, complete = false;
      for (let skip = 0; skip <= 20000; skip += 50) {
        const response = await fetcher(base + "/api/profile-offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, skip }), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.offers) || !Number.isSafeInteger(result.total) || result.total < 0) throw Error("Could not verify available offers.");
        if (expected < 0) expected = result.total;
        if (expected !== result.total) throw Error("Inventory changed during its update. Try again.");
        for (const offer of result.offers) {
          if (!/^[1-9]\d{5,11}$/.test(offer?.advertId) || offer.login?.toLowerCase() !== login.toLowerCase()) throw Error("Invalid account feed.");
          seen.add(offer.advertId);
        }
        if (skip + 50 >= expected) { complete = seen.size === expected; break; }
      }
      if (!complete) throw Error("The account feed is incomplete. Try again.");
      active.set(login.toLowerCase(), seen);
    }));
  }
  return items.filter(item => {
    const advertId = item.sourceUrl && new URL(item.sourceUrl).pathname.match(/\/(\d+)\/?$/)?.[1];
    return !!advertId && active.get(item.seller.toLowerCase())?.has(advertId);
  });
}
