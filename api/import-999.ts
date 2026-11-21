import { extractVideos } from "../server/videos.js";
import {
  advertDocument,
  descriptionFromDocument,
  visiblePairsFromDocument,
  sellerFromDocument,
} from "../server/extraction.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LISTING_UNAVAILABLE } from "../shared/refresh.js";

const HOSTS = new Set(["999.md", "www.999.md", "new.999.md"]);
const IMAGE_HOSTS = new Set([
  "i.simpalsmedia.com",
  "999.md",
  "www.999.md",
  "new.999.md",
]);
const MAX_HTML = 4 * 1024 * 1024;
const MAX_IMAGES = Number.MAX_SAFE_INTEGER;

class ListingUnavailableError extends Error {
  constructor() {
    super("That 999.md advert could not be found. It may have expired or been removed.");
  }
}

const FIELD_ALIASES: Record<string, string[]> = {
  deviceType: [
    "tip dispozitiv",
    "tipul dispozitivului",
    "тип устройства",
    "device type",
  ],
  batteryCapacity: [
    "capacitatea bateriei, mAh",
    "battery capacity mah",
    "емкость аккумулятора мач",
  ],
  generation: ["generation", "generație", "поколение"],
  brand: [
    "brand",
    "manufacturer",
    "marcă",
    "marca",
    "producător",
    "producator",
    "марка",
  ],
  model: ["model", "modelul", "device model", "product model", "модель"],
  storage: [
    "storage",
    "internal storage",
    "storage capacity",
    "memory capacity",
    "internal memory",
    "capacity",
    "stocare",
    "capacitate stocare",
    "capacitate de stocare",
    "spatiu de stocare",
    "memorie interna",
    "memoria interna",
    "memorie încorporată",
    "memorie incorporata",
    "capacitatea memoriei",
    "memorie",
    "память",
    "встроенная память",
    "объем памяти",
    "объём памяти",
  ],
  color: [
    "color",
    "colour",
    "culoare",
    "culoarea",
    "culoarea dispozitivului",
    "цвет",
  ],
  condition: [
    "condition",
    "device condition",
    "stare",
    "starea",
    "starea dispozitivului",
    "starea telefonului",
    "conditie",
    "состояние",
    "состояние устройства",
  ],
  batteryHealth: [
    "battery health",
    "battery condition",
    "battery",
    "baterie",
    "sanatatea bateriei",
    "sanatate baterie",
    "capacitate baterie",
    "capacitatea bateriei",
    "capacitatea bateriei %",
    "starea bateriei",
    "аккумулятор",
    "состояние батареи",
    "здоровье батареи",
    "емкость аккумулятора",
    "ёмкость аккумулятора",
  ],
  accessories: [
    "accessories",
    "included accessories",
    "package contents",
    "kit",
    "accesorii",
    "dotari",
    "ce este inclus",
    "continut pachet",
    "conținut pachet",
    "continutul pachetului",
    "conținutul pachetului",
    "complet",
    "completare",
    "комплектация",
    "в комплекте",
    "комплект",
  ],
  warranty: ["warranty", "garantie", "garantia", "гарантия"],
  availability: [
    "availability",
    "stock",
    "disponibilitate",
    "disponibil",
    "stoc",
    "наличие",
    "доступность",
    "статус объявления",
  ],
  category: [
    "type",
    "device type",
    "product type",
    "tip dispozitiv",
    "tipul dispozitivului",
    "tipul produsului",
    "tip",
    "tip produs",
    "tip dispozitiv",
    "tipul dispozitivului",
    "tipul produsului",
    "tipul",
    "categorie",
    "category",
    "тип",
    "вид устройства",
  ],
};

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .trim();
}
export function safeListingUrl(input: unknown): URL {
  if (typeof input !== "string" || input.length > 2048)
    throw new Error("Paste one public 999.md advert URL.");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (
    url.protocol !== "https:" ||
    !HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error(
      "Only public HTTPS advert links hosted on 999.md are supported.",
    );
  }
  if (!/^\/(?:ro|ru|en)\/\d+\/?$/i.test(url.pathname)) {
    throw new Error(
      "Paste an individual advert URL, not a category or search page.",
    );
  }
  url.hash = "";
  url.search = "";
  return url;
}
export async function fetchHtml(
  start: URL,
): Promise<{ html: string; finalUrl: URL }> {
  let current = start;
  const signal = AbortSignal.timeout(12_000);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VEYRA/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ro-RO,ro;q=0.9,ru;q=0.8,en;q=0.7",
      },
    }).catch((error: unknown) => {
      const failure = error as { name?: string; cause?: { code?: unknown } };
      const raw = String(
        failure.cause?.code || failure.name || "NETWORK_ERROR",
      );
      const code = /^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : "NETWORK_ERROR";
      console.warn("Marketplace connection failed", {
        advert: start.pathname,
        code,
      });
      throw new Error(
        `The connection to 999.md failed (${code}). Automatic updates will retry.`,
        { cause: error },
      );
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || hop === 3)
        throw new Error("The advert redirected too many times.");
      const next = new URL(location, current);
      if (
        next.protocol !== "https:" ||
        !HOSTS.has(next.hostname.toLowerCase()) ||
        next.port ||
        next.username ||
        next.password
      ) {
        throw new Error("999.md redirected outside its public advert domain.");
      }
      current = safeListingUrl(next.href);
      if (current.pathname.split("/")[2] !== start.pathname.split("/")[2])
        throw new Error("999.md redirected to a different advert.");
      continue;
    }
    if (!response.ok) {
      console.warn("Marketplace returned HTTP error", {advert:start.pathname,status:response.status});
      if (response.status === 403 || response.status === 429)
        throw new Error(
          `999.md declined the automated page request (HTTP ${response.status}). Open the advert normally and complete any missing details manually.`,
        );
      if (response.status === 404 || response.status === 410)
        throw new ListingUnavailableError();
      throw new Error(`999.md returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html"))
      throw new Error(
        "The supplied link did not return a public HTML advert page.",
      );
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_HTML)
      throw new Error("The advert page is larger than the importer allows.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty advert response.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML) {
        await reader.cancel();
        throw new Error("The advert page is larger than the importer allows.");
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    if (
      /<title[^>]*>[^<]*(?:captcha|just a moment|access denied)|cf-chl-|verify you are human/i.test(
        html,
      )
    )
      throw new Error(
        "999.md requires a browser verification. Please retry later.",
      );
    if (html.length > MAX_HTML)
      throw new Error("The advert page is larger than the importer allows.");
    return { html, finalUrl: current };
  }
  throw new Error("Could not open the public advert.");
}
function meta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=['"]${escaped}['"][^>]+content=['"]([^'"]*)['"][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=['"]([^'"]*)['"][^>]+(?:property|name|itemprop)=['"]${escaped}['"][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}
function plainText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).slice(0, 160_000);
}
export function deduplicateDescription(input: string): string {
  let value = decodeHtml(String(input || ""))
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  if (!value) return "";
  for (let copies = 2; copies <= 8; copies++) {
    const parts = value.split(/\n\s*\n/);
    if (parts.length % copies === 0) {
      const size = parts.length / copies;
      const first = parts.slice(0, size).join("\n\n");
      if (
        first.length >= 100 &&
        Array.from({ length: copies }, (_, i) =>
          parts.slice(i * size, (i + 1) * size).join("\n\n"),
        ).every((x) => x === first)
      ) {
        value = first;
        break;
      }
    }
  }

  // KMP prefix table: collapse an advert body that the page rendered two or
  // more times (for example, desktop + mobile copies in the same HTML).
  const prefix = new Array<number>(value.length).fill(0);
  for (let i = 1, j = 0; i < value.length; i++) {
    while (j > 0 && value[i] !== value[j]) j = prefix[j - 1];
    if (value[i] === value[j]) j++;
    prefix[i] = j;
  }
  const period = value.length - prefix[value.length - 1];
  if (period > 0 && period < value.length && value.length % period === 0) {
    value = value.slice(0, period).trim();
  }

  return value;
}
function visibleDescription(text: string): string {
  const match = text.match(
    /(?:^|\s)(?:descriere|description)\s+([\s\S]*?)(?=\s+(?:caracteristici principale|opțiuni|optiuni|loca(?:ție|tie)|tip ofertă|tip oferta|autorul anunțului|actualizat|vizualizări|arata numarul)\s|$)/i,
  );
  return deduplicateDescription(match?.[1] || "");
}
function normalizeLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const ALIAS_TO_FIELD = new Map<string, string>();
for (const [field, aliases] of Object.entries(FIELD_ALIASES))
  for (const alias of aliases) ALIAS_TO_FIELD.set(normalizeLabel(alias), field);
function fieldFromLabel(value: string): string | null {
  // Exact aliases avoid treating a complete label+value row (e.g. "Culoare Violet") as a label.
  const normalized = normalizeLabel(value);
  return ALIAS_TO_FIELD.get(normalized) || null;
}
function cleanValue(value: unknown): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s:–—\-•|·]+|[\s:–—\-•|·]+$/g, "");
  if (
    !text ||
    [
      "—",
      "-",
      "n/a",
      "na",
      "none",
      "null",
      "not specified",
      "не указано",
    ].includes(normalizeLabel(text))
  )
    return "";
  return text.slice(0, 220);
}
function addPair(out: Record<string, string[]>, label: string, value: unknown) {
  const field = fieldFromLabel(label);
  const clean = cleanValue(value);
  if (field && clean && !fieldFromLabel(clean)) (out[field] ||= []).push(clean);
}
function parseJsonScripts(html: string): any[] {
  const result: any[] = [];
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const attrs = match[1] || "";
    const source = match[2].trim();
    const type =
      attrs.match(/\btype=['"]([^'"]+)['"]/i)?.[1]?.toLowerCase() || "";
    const id = attrs.match(/\bid=['"]([^'"]+)['"]/i)?.[1]?.toLowerCase() || "";
    if (!(
      type.includes("json") ||
      [
        "__next_data__",
        "__nuxt_data__",
        "__initial_state__",
        "initial-state",
      ].includes(id)
    ))
      continue;
    try {
      result.push(JSON.parse(decodeHtml(source)));
    } catch {
      /* Some application data scripts are not standalone JSON. */
    }
  }
  return result;
}
function walkJson(
  value: any,
  visit: (key: string, child: any, parent: any) => void,
  parent: any = null,
) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit, parent);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, value);
    if (child && typeof child === "object") walkJson(child, visit, value);
  }
}
function findProducts(jsonValues: any[]): any[] {
  const products: any[] = [];
  for (const value of jsonValues)
    walkJson(value, (key, child) => {
      if (key !== "" || !child || typeof child !== "object") return;
      const type = child["@type"];
      if (
        type === "Product" ||
        (Array.isArray(type) && type.includes("Product"))
      )
        products.push(child);
    });
  // Walk each root explicitly; schema.org Product may be the root itself.
  for (const value of jsonValues)
    walkJson(value, (_key, child) => {
      if (child && typeof child === "object") {
        const type = child["@type"];
        if (
          type === "Product" ||
          (Array.isArray(type) && type.includes("Product"))
        )
          products.push(child);
      }
    });
  for (const value of jsonValues) {
    if (value?.["@type"] === "Product") products.unshift(value);
    if (Array.isArray(value))
      for (const item of value)
        if (item?.["@type"] === "Product") products.unshift(item);
  }
  return [...new Set(products)];
}
function extractPairs(
  html: string,
  jsonValues: any[],
  visibleCharacteristics: [string, string][],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [label, value] of visibleCharacteristics)
    addPair(out, label, value);
  for (const value of jsonValues)
    walkJson(value, (key, child, parent) => {
      if (["string", "number"].includes(typeof child)) addPair(out, key, child);
      if (child && typeof child === "object" && !Array.isArray(child)) {
        const label =
          child.label ||
          child.name ||
          child.title ||
          child.feature ||
          child.attribute;
        const value =
          child.value ?? child.content ?? child.text ?? child.displayValue;
        if (
          typeof label === "string" &&
          ["string", "number"].includes(typeof value)
        )
          addPair(out, label, value);
      }
      if (parent && typeof parent === "object" && !Array.isArray(parent)) {
        const label =
          parent.label ||
          parent.name ||
          parent.title ||
          parent.feature ||
          parent.attribute;
        const value =
          parent.value ?? parent.content ?? parent.text ?? parent.displayValue;
        if (
          typeof label === "string" &&
          ["string", "number"].includes(typeof value)
        )
          addPair(out, label, value);
      }
    });
  const tags = ["dt", "dd", "th", "td", "label", "span", "div", "li", "p"];
  const contentOf = (tag: string) =>
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  // Semantic definition-list and table rows.
  for (const tag of ["dt", "th", "label"]) {
    const rx = new RegExp(
      `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>\\s*<(?:dd|td|span|div)\\b[^>]*>([\\s\\S]*?)<\\/(?:dd|td|span|div)>`,
      "gi",
    );
    for (const match of html.matchAll(rx))
      addPair(out, plainText(match[1]), plainText(match[2]));
  }
  // Common listing feature card: adjacent label/value spans or divs.
  const pairRx =
    /<(?:div|li|p)\b[^>]*>\s*<(?:span|strong|b|div)\b[^>]*>([\s\S]{1,100}?)<\/(?:span|strong|b|div)>\s*<(?:span|div|p)\b[^>]*>([\s\S]{1,180}?)<\/(?:span|div|p)>/gi;
  for (const match of html.matchAll(pairRx))
    addPair(out, plainText(match[1]), plainText(match[2]));
  // Explicit data attributes used by common React/Vue feature lists.
  const dataRx =
    /<[^>]+\bdata-(?:label|name)=['"]([^'"]+)['"][^>]*\bdata-value=['"]([^'"]*)['"][^>]*>/gi;
  for (const match of html.matchAll(dataRx))
    addPair(out, decodeHtml(match[1]), decodeHtml(match[2]));

  return out;
}
function inlineValue(text: string, field: string): string {
  const aliases = FIELD_ALIASES[field] || [];
  const allAliases = Object.values(FIELD_ALIASES)
    .flat()
    .sort((a, b) => b.length - a.length);
  const escapeRx = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextLabel = allAliases.map(escapeRx).join("|");
  const stop = `(?=\\s*(?:${nextLabel})(?:\\s|[:=,%\\-]|$)|[|;•\\n]|$)`;
  for (const alias of [...aliases].sort((a, b) => b.length - a.length)) {
    const rx = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRx(alias)}\\s*[:=,%\\-]*\\s*(.{1,160}?)${stop}`,
      "iu",
    );
    const match = text.match(rx);
    if (match?.[1]) {
      const value = cleanValue(match[1]);
      if (value && !fieldFromLabel(value)) return value;
    }
  }
  return "";
}
function firstPair(pairs: Record<string, string[]>, field: string): string {
  return (pairs[field] || []).map(cleanValue).find(Boolean) || "";
}
function inferBrand(title: string, product: any): string {
  const raw =
    typeof product?.brand === "object" ? product.brand.name : product?.brand;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const brands = [
    "Samsung",
    "Xiaomi",
    "Google",
    "Huawei",
    "Honor",
    "OnePlus",
    "Motorola",
    "Nothing",
    "Realme",
    "Oppo",
    "Vivo",
    "Tecno",
    "Infinix",
    "Nokia",
    "Sony",
    "Asus",
    "Apple",
    "Lenovo",
    "ZTE",
    "Poco",
    "Redmi",
  ];
  return (
    brands.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(title)) ||
    (/\biphone\b/i.test(title)
      ? "Apple"
      : /\bpixel\b/i.test(title)
        ? "Google"
        : "")
  );
}
function detectColor(text: string): string {
  const colors = [
    "Natural Titanium",
    "Desert Titanium",
    "Black Titanium",
    "White Titanium",
    "Blue Titanium",
    "Space Black",
    "Space Gray",
    "Space Grey",
    "Titanium Natural",
    "Titan Natural",
    "Midnight",
    "Starlight",
    "Graphite",
    "Grafit",
    "Silver",
    "Gold",
    "Black",
    "White",
    "Blue",
    "Green",
    "Pink",
    "Purple",
    "Violet",
    "Red",
    "Yellow",
    "Orange",
    "Gray",
    "Grey",
    "Burgundy",
    "Brown",
    "Beige",
    "Bej",
    "Crem",
    "Sur",
    "Natural",
    "Negru",
    "Neagră",
    "Alb",
    "Albă",
    "Albastru deschis",
    "Albastru închis",
    "Albastru",
    "Albastră",
    "Verde",
    "Roz",
    "Mov",
    "Violet",
    "Roșu",
    "Roșie",
    "Galben",
    "Portocaliu",
    "Gri",
    "Auriu",
    "Argintiu",
    "Titan natural",
    "Черный",
    "Белый",
    "Синий",
    "Зеленый",
    "Розовый",
    "Золотой",
    "Серый",
  ];
  for (const color of colors.sort((a, b) => b.length - a.length)) {
    const match = text.match(
      new RegExp(
        `(?<![\\w])${color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`,
        "i",
      ),
    );
    if (match) return match[0];
  }
  return "";
}
function extractWarranty(description: string, labelledValue: string): string {
  const text = description || "";
  const period =
    /(?:garan[tț]ie|warranty|гарантия)\s*(?:comercial[aă]\s*)?(?:de\s*)?[:\-]?\s*(\d+\s*(?:luni|months?|month|ani|years?|year|месяц(?:а|ев)?|год(?:а|лет)?))/i.exec(
      text,
    ) ||
    /(\d+\s*(?:luni|months?|month|ani|years?|year|месяц(?:а|ев)?|год(?:а|лет)?))\s+(?:de\s+)?(?:garan[tț]ie|warranty|гарантия)/i.exec(
      text,
    );
  if (period?.[1]) return period[1].replace(/\s+/g, " ").trim();
  const value = cleanValue(labelledValue);
  if (!value) return "";
  const valuePeriod =
    /(\d+\s*(?:luni|months?|month|ani|years?|year|месяц(?:а|ев)?|год(?:а|лет)?))/i.exec(
      value,
    );
  return (
    valuePeriod?.[1] ||
    (/^(?:lifetime|pe viață|fara garantie|no warranty|без гарантии)$/i.test(
      value,
    )
      ? value
      : "")
  );
}
function extractAccessories(
  description: string,
  labelledValue: string,
): string {
  const text = description || "";
  const explicit =
    /(?:con[tț]inut(?:ul)?\s+(?:pachet(?:ului)?|cutiei)|package contents|included in (?:the )?box|in the box|în\s+pachet|in\s+pachet|în\s+set|in\s+set|setul\s+include|в\s+комплекте|комплектация)\s*[:\-]?\s*([^.!?\n]{2,190})/i.exec(
      text,
    ) ||
    /(?:accesori(?:i|ile)|accessories)\s*(?:incluse|included)?\s*[:\-]\s*([^.!?\n]{2,190})/i.exec(
      text,
    );
  if (explicit?.[1]) return explicit[1].trim();
  const accessoryTerms = [
    "cutie",
    "husă",
    "husa",
    "cablu",
    "încărcător",
    "incarcator",
    "folie",
    "peliculă",
    "pelicula",
    "case",
    "charger",
    "cable",
    "box",
    "adapter",
    "earphones",
    "наушники",
    "коробка",
    "чехол",
    "кабель",
    "зарядка",
    "документы",
  ];
  const clause = text
    .split(/[.!?\n]/)
    .map((x) => x.trim())
    .find((part) =>
      accessoryTerms.some((term) =>
        new RegExp(`(?<!\\w)${term}(?!\\w)`, "i").test(part),
      ),
    );
  if (clause) return clause;
  if (
    /(?:accesoriile incluse|accessories included|comes with accessories|accesorii incluse)/i.test(
      text,
    )
  )
    return "Included accessories (details not specified)";
  const value = cleanValue(labelledValue);
  if (!value) return "";
  const trimmed = value
    .replace(/^(?:accesorii|accessories)\s*/i, "")
    .replace(/^(?:incluse|included)\s*/i, "")
    .trim();
  return (
    trimmed || (value ? "Included accessories (details not specified)" : "")
  );
}

function mapCondition(value: string, context: string): string {
  const text = `${value} ${context}`.toLowerCase();
  const tests: Array<[string, RegExp[]]> = [
    [
      "For parts",
      [/for parts/, /pentru piese/, /на запчасти/, /defect/, /неисправ/],
    ],
    [
      "Like new",
      [
        /like new/,
        /ca nou/,
        /как новый/,
        /stare perfecta/,
        /stare ideal[aă]/,
        /impecabil/,
      ],
    ],
    ["Refurbished", [/refurbished/i, /recondiționat/i, /восстановлен/i]],
    [
      "New",
      [
        /\bnew\b/,
        /\bnou\b/,
        /sigilat/,
        /sealed/,
        /нов(?:ый|ая|ое)/,
        /запечатан/,
      ],
    ],
    ["Excellent", [/excellent/, /excelent/, /отличн/]],
    ["Very good", [/very good/, /foarte bun/, /очень хорош/]],
    [
      "Good",
      [/\bgood\b/, /\bbun(?:a|ă)?\b/, /stare buna/, /хорошее состояние/],
    ],
    ["Used", [/\bused\b/, /uzat/, /folosit/, /б\/у/, /подержан/]],
  ];
  for (const [label, expressions] of tests)
    if (expressions.some((rx) => rx.test(text))) return label;
  const score = text.match(
    /(?:stare|starea|condition|состояние)[^\d]{0,12}(10|[1-9])\s*\/\s*10/i,
  );
  if (score) {
    const n = Number(score[1]);
    return n >= 9
      ? "Like new"
      : n === 8
        ? "Very good"
        : n >= 6
          ? "Good"
          : "Used";
  }
  return "";
}
function mapCategory(value: string, context: string): string {
  const text = `${value} ${context}`.toLowerCase();
  if (/\b(tablet|tablete|ipad|планшет)\b/.test(text)) return "tablet";
  if (/\b(laptop|laptopuri|macbook|notebook|ноутбук)\b/.test(text))
    return "laptop";
  if (/\b(desktop|imac|mac mini|pc tower|calculatoare)\b/.test(text))
    return "desktop";
  if (
    /\b(watch|smartwatch|apple watch|ceasuri|ceas inteligent|часы)\b/.test(text)
  )
    return "watch";
  if (
    /\b(airpods|earbuds|headphones|headset|căști|casti|наушники)\b/.test(text)
  )
    return "audio";
  if (/\b(case|charger|cable|cover|accessory|accesoriu|аксессуар)\b/.test(text))
    return "accessory";
  return /iphone|smartphone|telefon|phone|телефон/i.test(text) ? "phone" : "";
}
function parsePrice(
  products: any[],
  metaValue: (key: string) => string,
  text: string,
): { price: number | null; currency: string } {
  let amount =
    metaValue("product:price:amount") || metaValue("og:price:amount");
  let currency = (
    metaValue("product:price:currency") || metaValue("og:price:currency")
  ).toUpperCase();
  for (const product of products) {
    const values = Array.isArray(product.offers)
      ? product.offers
      : [product.offers];
    for (const offer of values)
      if (offer && typeof offer === "object") {
        amount ||= String(offer.price || offer.lowPrice || "");
        currency ||= String(offer.priceCurrency || "").toUpperCase();
      }
  }
  let price: number | null = null;
  if (amount) {
    let raw = amount.replace(/[^0-9.,]/g, "");
    const commaIndex = raw.lastIndexOf(",");
    const hasDecimalComma =
      commaIndex >= 0 &&
      !raw.includes(".") &&
      raw.length - commaIndex - 1 === 2;
    if (hasDecimalComma) raw = raw.replace(",", ".");
    else raw = raw.replace(/,/g, "");
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) price = parsed;
  }
  if (price == null) {
    const match = text.match(
      /(?<!\d)(\d[\d\s\u00a0]*(?:[.,]\d{1,2})?)\s*(MDL|lei|EUR|€|USD|\$)/i,
    );
    if (match) {
      const parsed = Number(
        match[1].replace(/[\s\u00a0]/g, "").replace(",", "."),
      );
      if (Number.isFinite(parsed)) {
        price = parsed;
        currency =
          ({ LEI: "MDL", "€": "EUR", $: "USD" } as Record<string, string>)[
            match[2].toUpperCase()
          ] || match[2].toUpperCase();
      }
    }
  }
  if (["LEI", "MDL"].includes(currency)) currency = "MDL";
  if (["€", "EURO"].includes(currency)) currency = "EUR";
  if (["$", "US$"].includes(currency)) currency = "USD";
  return { price, currency };
}
function uniqueImages(items: unknown[], base: URL): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const value =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object"
          ? (raw as any).url || (raw as any).contentUrl || (raw as any)["@id"]
          : "";
    if (typeof value !== "string" || !value.trim() || value.startsWith("data:"))
      continue;
    try {
      const url = new URL(value, base);
      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        !IMAGE_HOSTS.has(url.hostname.toLowerCase())
      )
        continue;
      if (!/BoardImages|\.(?:jpe?g|png|webp)(?:$|\?)/i.test(url.pathname))
        continue;
      url.pathname = url.pathname.replace(/\/{2,}/g, "/");
      if (/avatar|logo|banner/i.test(url.pathname)) continue;
      const imageKey = url.hostname + url.pathname.replace(/\/\d+x\d+\//g, "/");
      if (seen.has(imageKey)) continue;
      seen.add(imageKey);
      url.hash = "";
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      result.push(url.href);
      if (result.length >= MAX_IMAGES) break;
    } catch {
      /* Skip invalid image URL. */
    }
  }
  return result;
}
export function parseListing(html: string, url: URL) {
  const originalHtml = html;
  const document = advertDocument(html);
  html = document.html();
  const characteristics = visiblePairsFromDocument(document);
  const jsonValues = parseJsonScripts(html);
  const products = findProducts(jsonValues);
  const product = products[0] || {};
  const title =
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    String(
      product.name ||
        decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
    );
  const metaDescription = deduplicateDescription(
    meta(html, "og:description") ||
      meta(html, "description") ||
      String(product.description || ""),
  );
  const text = plainText(html);
  const visible = descriptionFromDocument(document);
  const bodyDescription = visible || visibleDescription(text);
  // Prefer the visible advert description when it contains more detail than the social preview.
  const description = deduplicateDescription(
    bodyDescription || metaDescription,
  );
  const detailText = `${metaDescription} ${bodyDescription}`.trim();
  const pairs = extractPairs(html, jsonValues, characteristics);
  for (const key of Object.keys(FIELD_ALIASES)) {
    const v = meta(html, key);
    if (v) addPair(pairs, key, v);
  }
  const feature = (field: string) =>
    firstPair(pairs, field) || inlineValue(`${description} ${title}`, field);

  const storageValue = feature("storage");
  const storageMatch = `${title} ${description} ${bodyDescription}`.match(
    /\b(\d{1,4}\s?(?:GB|TB))\b/i,
  );
  const storageExplicit = storageValue.match(/\b\d{1,4}\s?(?:GB|TB)\b/i);
  const storage = (storageExplicit?.[0] || storageMatch?.[1] || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const color =
    detectColor(feature("color")) ||
    detectColor(`${title} ${description} ${bodyDescription}`);
  const conditionValue = feature("condition");
  const condition =
    mapCondition(conditionValue, "") ||
    mapCondition("", `${title} ${description} ${bodyDescription}`);
  const batteryValue = feature("batteryHealth");
  const batteryMatch =
    `${title} ${description} ${bodyDescription} ${batteryValue}`.match(
      /(?:battery(?:\s+health)?|bater(?:ie|ia)(?:\s+(?:health|sanatate))?|capacitatea bateriei|s[aă]n[aă]tatea bateriei|аккумулятор|батарея)[^%\n]{0,70}(\d{2,3})\s*%/i,
    ) ||
    batteryValue.match(/(?<!\d)(\d{2,3})\s*%/) ||
    (batteryValue.match(/^\s*(\d{1,3})\s*$/)
      ? batteryValue.match(/^\s*(\d{1,3})\s*$/)
      : null);
  const batteryNumber = batteryMatch ? Number(batteryMatch[1]) : NaN;
  const batteryHealth =
    Number.isFinite(batteryNumber) && batteryNumber >= 0 && batteryNumber <= 100
      ? batteryNumber
      : "";

  const warrantyValue = feature("warranty");
  const warranty = extractWarranty(detailText, warrantyValue);
  const accessoriesValue = feature("accessories");
  const accessories = extractAccessories(detailText, accessoriesValue);
  const availabilityValue = feature("availability");
  const availabilityText = `${availabilityValue} ${detailText}`.toLowerCase();
  const availability = /\b(v[aâ]ndut|sold|продан)\b/.test(availabilityText)
    ? "sold"
    : /\b(rezervat|reserved|забронирован)\b/.test(availabilityText)
      ? "reserved"
      : /\b(disponibil(?:[aă] imediat)?|available|in stock|в наличии)\b/.test(
            availabilityText,
          )
        ? "available"
        : "";
  const categoryValue = feature("category");
  const category = mapCategory(
    categoryValue,
    `${title} ${description} ${bodyDescription}`,
  );
  const brand = feature("brand") || inferBrand(title, product);
  let model =
    feature("model") ||
    String(product.model || "").trim() ||
    title.replace(/\s*[|–—-]\s*999\.md.*$/i, "").trim();
  model = model
    .replace(/\b\d{1,4}\s?(?:GB|TB)\b/gi, "")
    .replace(/\s*\d{2,3}\s*%(?=\s|$)/g, "")
    .replace(/\s*[/|–—-]+\s*/g, " ")
    .trim();
  if (
    brand &&
    new RegExp(
      `^\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    ).test(model)
  )
    model =
      model
        .replace(
          new RegExp(
            `^\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
            "i",
          ),
          "",
        )
        .trim() || title;

  const imageList: unknown[] = [];
  for (const key of [
    "og:image",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
  ]) {
    const value = meta(html, key);
    if (value) imageList.push(value);
  }
  for (const productValue of products) {
    if (productValue.image)
      imageList.push(
        ...(Array.isArray(productValue.image)
          ? productValue.image
          : [productValue.image]),
      );
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    for (const attr of [
      "src",
      "data-src",
      "data-original",
      "data-lazy-src",
      "data-image",
    ]) {
      const src = tag.match(
        new RegExp(`\\b${attr}=['"]([^'"]+)['"]`, "i"),
      )?.[1];
      if (src) imageList.push(src);
    }
    const srcset = tag.match(/\bsrcset=['"]([^'"]+)['"]/i)?.[1];
    if (srcset)
      imageList.push(...srcset.split(",").map((x) => x.trim().split(/\s+/)[0]));
  }
  walkJson(jsonValues, (key, value) => {
    if (
      [
        "image",
        "images",
        "photourl",
        "photourls",
        "imageurl",
        "imageurls",
        "photo",
        "photos",
        "picture",
        "pictures",
        "gallery",
        "galleryimages",
        "mainimage",
        "thumbnail",
      ].includes(normalizeLabel(key).replace(/\s/g, ""))
    )
      imageList.push(...(Array.isArray(value) ? value : [value]));
  });
  const images = uniqueImages(imageList, url);
  const { price, currency } = parsePrice(
    products,
    (key) => meta(html, key),
    `${title} ${description} ${text.slice(0, 3000)}`,
  );
  const fieldsFound = {
    storage: Boolean(storage),
    color: Boolean(color),
    condition: Boolean(condition),
    batteryHealth: batteryHealth !== "",
    accessories: Boolean(accessories),
    warranty: Boolean(warranty),
    availability: Boolean(
      availabilityValue ||
      /\b(v[aâ]ndut|sold|rezervat|reserved|продан|забронирован|disponibil|available|in stock|в наличии)\b/i.test(
        detailText,
      ),
    ),
    category: Boolean(
      categoryValue ||
      category !== "phone" ||
      /\b(?:phone|smartphone|iphone|telefon(?:e)?|mobile)\b/i.test(
        `${title} ${description}`,
      ),
    ),
  };
  return {
    ...sellerFromDocument(document, product),
    videos: extractVideos(originalHtml),
    title,
    description,
    url: url.href,
    price,
    currency,
    images,
    imageCount: images.length,
    deviceType: feature("deviceType"),
    modelGeneration: feature("generation"),
    advertId: url.pathname.match(/\d+/)?.[0],
    rawCharacteristics: pairs,
    characteristics: characteristics.map(([label, value]) => ({
      label,
      value,
    })),
    batteryCapacityMah:
      Number(
        `${description} ${text}`.match(/(\d{3,6})\s*(?:mAh|мАч|мА·ч)/i)?.[1],
      ) || null,
    batteryHealth,
    accessories,
    warranty,
    availability,
    fieldsFound,
    fieldsFoundCount: Object.values(fieldsFound).filter(Boolean).length,
    fieldsTotal: Object.keys(fieldsFound).length,
    ...{ brand, model, storage, color, condition, category },
  };
}

const cache = new Map<
  string,
  { expires: number; listing: ReturnType<typeof parseListing> }
>();
type ImportStage = "fetching" | "extracting";
type ImportJob = {
  stage: ImportStage;
  listeners: Set<(stage: ImportStage) => void>;
  promise?: Promise<ReturnType<typeof parseListing>>;
};
const pendingImports = new Map<string, ImportJob>();
function freshListing(
  url: URL,
  key: string,
  onStage: (stage: ImportStage) => void,
) {
  let job = pendingImports.get(key);
  if (!job) {
    if (pendingImports.size >= 100)
      throw Error("The importer is busy. Please try again shortly.");
    const created: ImportJob = { stage: "fetching", listeners: new Set() };
    created.promise = (async () => {
      const { html, finalUrl } = await fetchHtml(url);
      created.stage = "extracting";
      for (const listener of created.listeners) {
        try {
          listener("extracting");
        } catch {
          created.listeners.delete(listener);
        }
      }
      const listing = parseListing(html, finalUrl);
      if (
        (!listing.title ||
          /^(?:999\.md|log\s?in|sign\s?in|autentificare)$/i.test(
            listing.title.trim(),
          )) &&
        !listing.images.length
      )
        throw Error(
          "The public page did not expose listing details. Please retry later.",
        );
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 300000, listing });
      return listing;
    })();
    pendingImports.set(key, created);
    void created.promise
      .finally(() => {
        if (pendingImports.get(key) === created) pendingImports.delete(key);
      })
      .catch(() => {});
    job = created;
  }
  job.listeners.add(onStage);
  onStage(job.stage);
  const active = job;
  return job.promise!.finally(() => active.listeners.delete(onStage));
}
const requests = new Map<string, { until: number; count: number }>();
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean);
  if (origin && allowed.includes(origin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ ok: false, error: "Use POST for one advert URL." });
  const streamed = req.headers.accept === "application/x-ndjson";
  const emit = (stage: string, extra: object = {}) => {
    if (streamed) {
      if (res.destroyed || res.writableEnded) return;
      if (!res.headersSent)
        res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify({ stage, ...extra }) + "\n");
    }
  };
  try {
    const url = safeListingUrl((req.body as any)?.url);
    const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0];
    if (requests.size > 1000) requests.clear();
    const entry = requests.get(ip);
    if (entry && entry.until > Date.now() && entry.count >= 20)
      return res
        .status(429)
        .json({ ok: false, error: "Too many imports. Please wait a minute." });
    requests.set(
      ip,
      entry && entry.until > Date.now()
        ? { ...entry, count: entry.count + 1 }
        : { until: Date.now() + 60000, count: 1 },
    );
    emit("validating");
    const key = url.pathname.match(/\d+/)![0];
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now() && !req.body?.refresh) {
      emit("completed", { ok: true, listing: saved.listing });
      return streamed
        ? res.end()
        : res.json({ ok: true, listing: saved.listing });
    }
    const listing = await freshListing(url, key, emit);
    emit("completed", { ok: true, listing });
    return streamed ? res.end() : res.status(200).json({ ok: true, listing });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not read this public 999.md advert.";
    const unavailable = error instanceof ListingUnavailableError;
    const failure = { ok: false, error: message, ...(unavailable && { code: LISTING_UNAVAILABLE }) };
    const status = unavailable ? 404 : /valid|https|individual|category|Paste/i.test(message)
      ? 400
      : 502;
    if (streamed && res.headersSent) {
      emit("failed", failure);
      return res.end();
    }
    return res.status(status).json(failure);
  }
}
