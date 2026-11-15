export const PROFILE_PAGE_SIZE = 50;
export function profileLogin(value: unknown): string {
  if (typeof value !== "string" || !/^[\p{L}\p{N}_.+-]{1,60}$/u.test(value)) throw Error("A verified public username is required.");
  return value;
}
export type ProfileOffer = { advertId: string; title: string; login: string; price?: number; currency?: string; photos: string[] };
export function readProfileOffers(body: any, login: string): { offers: ProfileOffer[]; total: number } {
  const data = body?.data?.profileAds;
  if (body?.errors?.length || !data || !Array.isArray(data.ads) || !Number.isSafeInteger(data.count) || data.count < 0 || data.ads.length > PROFILE_PAGE_SIZE) throw Error("999.md did not return its public offers. Saved details are kept.");
  const offers: ProfileOffer[] = [];
  const seen = new Set<string>();
  for (const ad of data.ads) {
    if (!/^[1-9]\d{5,11}$/.test(ad?.id) || ad.state !== "AD_STATE_PUBLIC" || typeof ad.title !== "string" || ad.title.length > 1000 || ad.owner?.login?.toLowerCase() !== login.toLowerCase()) continue;
    if (seen.has(ad.id)) continue;
    seen.add(ad.id);
    const price = ad.price?.value;
    const currency = typeof price?.unit === "string" ? /^UNIT_(MDL|EUR|USD)$/.exec(price.unit)?.[1] : undefined;
    const photos = (Array.isArray(ad.images?.value) ? ad.images.value : []).flatMap((value: unknown) => {
      if (typeof value !== "string") return [];
      const file = value.split("?")[0];
      return /^[a-f\d]{30,36}\.(?:jpe?g|png|webp)$/i.test(file) ? ["https://i.simpalsmedia.com/999.md/BoardImages/900x900/" + file] : [];
    });
    offers.push({ advertId: ad.id, title: ad.title, login: ad.owner.login, photos: [...new Set<string>(photos)], ...(currency && Number.isFinite(price.value) && price.value > 0 ? { currency, price: price.value } : {}) });
  }
  return { offers, total: data.count };
}
export async function fetchProfileOffers(login: string, skip: number, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const response = await fetcher("https://999.md/graphql", {
    method: "POST", redirect: "error", signal,
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Language": "ro" },
    body: JSON.stringify({ operationName: "ResellProfileOffers", query: "query ResellProfileOffers($input:Ads_ProfileInput){profileAds(input:$input){count ads{id title state owner{login} price:feature(id:2){value} images:feature(id:14){value}}}}", variables: { input: { login: profileLogin(login), pagination: { skip, limit: PROFILE_PAGE_SIZE } } } }),
  });
  if (!response.ok) throw Error(response.status === 429 ? "999.md is limiting updates. They will retry later." : "Public offers are unavailable from 999.md.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty marketplace response.");
  let text = "", bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 1024 * 1024) throw Error("Marketplace response exceeded its limit."); text += decoder.decode(next.value, { stream: true }); }
    return readProfileOffers(JSON.parse(text + decoder.decode()), login);
  } finally { await reader.cancel().catch(() => {}); }
}
