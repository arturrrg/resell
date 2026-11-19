import { publicationIsVisible } from "./offers/publication-presence";

export type PublicInventoryItem = {
  id: string; title: string; brand: string; storage: string; color: string; condition: string;
  battery: string; price?: number; currency: string; description: string; seller: string;
  sourceUrl: string; photos: string[]; specs: { label: string; value: string }[];
  videos: { url: string; embedUrl?: string; kind: "embed" | "video"; poster?: string }[];
};
const text = (value: unknown) => typeof value === "string" ? value : "";
function https(value: unknown) {
  try { const url = new URL(text(value)); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export function publicInventoryItems(value: unknown): PublicInventoryItem[] {
  if (!Array.isArray(value)) throw Error("This inventory could not be opened.");
  return value.filter(row => row && typeof row.id === "string" && row.saleStatus !== "sold" && publicationIsVisible(row)).map(row => {
    const source = https(row.listingUrl);
    let sourceUrl = "";
    if (source) { const url = new URL(source); if (["999.md", "www.999.md", "new.999.md"].includes(url.hostname) && /^\/(?:ro|ru|en)\/\d+\/?$/.test(url.pathname)) sourceUrl = source; }
    const specs = (Array.isArray(row.characteristics) ? row.characteristics : []).filter((spec: any) => text(spec?.label) && text(spec?.value)).map((spec: any) => ({ label: text(spec.label), value: text(spec.value) }));
    return {
      id: row.id, title: text(row.model) || text(row.title) || "Device", brand: text(row.brand), storage: text(row.storage), color: text(row.color), condition: text(row.condition),
      battery: typeof row.batteryHealth === "number" || typeof row.batteryHealth === "string" ? String(row.batteryHealth) : "",
      price: typeof row.sourcePrice === "number" && Number.isFinite(row.sourcePrice) && row.sourcePrice >= 0 ? row.sourcePrice : undefined,
      currency: text(row.currency), description: text(row.listingDescription), seller: text(row.sellerName), sourceUrl,
      photos: [...new Set<string>((Array.isArray(row.photos) ? row.photos : []).map(https).filter(Boolean))], specs,
      videos: (Array.isArray(row.videos) ? row.videos : []).flatMap((video: any) => {
        const url = https(video?.url), embedUrl = https(video?.embedUrl);
        if (!url) return [];
        if (video.kind === "video") return [{ url, kind: "video" as const, poster: https(video.poster) || undefined }];
        if (embedUrl && ["player.vimeo.com", "www.youtube-nocookie.com", "www.youtube.com"].includes(new URL(embedUrl).hostname)) return [{ url, embedUrl, kind: "embed" as const, poster: https(video.poster) || undefined }];
        return [];
      }),
    };
  });
}
