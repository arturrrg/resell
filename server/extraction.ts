import { load, type CheerioAPI } from "cheerio";
export function advertDocument(html: string) {
  const $ = load(html);
  $('[class*="recommend"],[class*="similar"],nav,footer,aside').remove();
  return $;
}
export function sellerFromHtml(html: string, product: any = {}) {
  return sellerFromDocument(advertDocument(html), product);
}
export function sellerFromDocument($: CheerioAPI, product: any = {}) {
  const node = $(
    '[class*="user__card__login"], [data-testid="seller-name"], [itemprop="seller"] [itemprop="name"]',
  )
    .filter((_, el) => !$(el).attr("class")?.includes("wrapper"))
    .first();
  const offers = Array.isArray(product.offers)
    ? product.offers
    : [product.offers];
  const seller =
    offers.find((offer: any) => offer?.seller?.name)?.seller || product.seller;
  const sellerName = (
    node.text().trim() || (typeof seller?.name === "string" ? seller.name : "")
  )
    .replace(/\s+/g, " ")
    .slice(0, 160);
  let sellerUrl = "";
  const href = node.is("a")
    ? node.attr("href")
    : node.closest("a").attr("href");
  try {
    const url = new URL(href || seller?.url || "", "https://999.md");
    if (
      url.protocol === "https:" &&
      ["999.md", "www.999.md", "new.999.md"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/(?:ro|ru|en)\/profile\/[^/]+\/?$/.test(url.pathname)
    )
      sellerUrl = `https://999.md${url.pathname}`;
  } catch {
    /* A missing/unsafe profile URL does not prevent importing the name. */
  }
  return { sellerName, sellerUrl };
}
export function descriptionFromHtml(html: string) {
  return descriptionFromDocument(advertDocument(html));
}
export function descriptionFromDocument($: CheerioAPI) {
  const candidates: string[] = [];
  const excluded =
    'script,style,noscript,[hidden],[aria-hidden="true"],[class*="description__measure"],[class*="description__title"]';
  $(
    '[class*="description__body"],[itemprop="description"],.adPage__content__description,.adPage__description,[data-testid="ad-description"],[class*="ad-description"],[class*="adDescription"]',
  ).each((_, el) => {
    const source = $(el);
    if (source.is(excluded) || source.parents(excluded).length) return;
    const node = source.clone();
    node.find(excluded).remove();
    node.find("br").replaceWith("\n");
    node.find("p,div,li").append("\n");
    const text = node
      .text()
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text) candidates.push(text);
  });
  return candidates.sort((a, b) => b.length - a.length)[0] || "";
}
export function scopeHtml(html: string) {
  return advertDocument(html).html();
}
export function visiblePairs(html: string) {
  return visiblePairsFromDocument(advertDocument(html));
}
export function visiblePairsFromDocument($: CheerioAPI) {
  const pairs: [string, string][] = [];
  $("li, tr").each((_, el) => {
    const row = $(el);
    const key = row.find('[class*="group__key"],th').first();
    if (key.length) {
      const value = key
        .nextAll()
        .filter((_, n) => !$(n).attr("class")?.includes("dotted"))
        .text()
        .trim();
      if (value) pairs.push([key.text().trim(), value]);
    }
  });
  $("dt").each((_, el) => {
    const value = $(el).next("dd").text().trim();
    if (value) pairs.push([$(el).text().trim(), value]);
  });
  const seen = new Set<string>();
  return pairs
    .map(
      ([label, value]) =>
        [
          label.replace(/\s+/g, " ").trim(),
          value.replace(/\s+/g, " ").trim(),
        ] as [string, string],
    )
    .filter(([label, value]) => {
      const key = `${label.normalize("NFKC").toLowerCase()}:${value.normalize("NFKC").toLowerCase()}`;
      if (!label || !value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
