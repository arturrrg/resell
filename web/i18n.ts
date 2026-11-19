import { useSyncExternalStore } from "react";
import { catalog } from "./translations";
import { errorCatalog } from "./translation-errors";
import { specificationLabel } from "./inventory-fields";

export type Language = "en" | "ro" | "ru";
export const LANGUAGE_STORAGE_KEY = "resell.language";
const validLanguage = (value: unknown): Language => value === "ro" || value === "ru" ? value : "en";
let language: Language = "en";
try { language = validLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)); } catch {}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLanguage = () => language;
export const localeFor = (value: Language = language) => ({ en: "en-GB", ro: "ro-MD", ru: "ru-MD" })[value];
function applyLanguage(next: Language) {
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function setLanguage(next: Language) {
  next = validLanguage(next);
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch {}
  if (language !== next) applyLanguage(next);
}
export function useLanguage() { return useSyncExternalStore(subscribe, getLanguage, () => "en" as Language); }
if (typeof document !== "undefined") document.documentElement.lang = language;
if (typeof window !== "undefined") window.addEventListener("storage", event => {
  if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) applyLanguage(validLanguage(event.newValue));
});
export const messages = { ...catalog, ...errorCatalog };
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();
const aliases = new Map<string, string>();
const exactAliases = new Map<string, string>();
for (const [en, translations] of Object.entries(messages)) {
  for (const text of [en, ...translations]) if (!text.includes("{")) {
    aliases.set(normalize(text).toLowerCase(), en);
    exactAliases.set(normalize(text), en);
  }
}
const additionalAliases: Record<string, string> = {
  "nouă": "New", "noua": "New", "новое": "New", "новая": "New", "неиспользованный": "New",
  "uzat": "Used", "folosit": "Used", "folosită": "Used", "б/у": "Used", "подержанный": "Used",
  "neutilizat": "New", "nefolosit": "New", "pentru piese": "For parts", "на запчасти": "For parts",
  "smartphone": "Smartphones", "smartphone-uri": "Smartphones", "смартфон": "Smartphones", "смартфоны": "Smartphones",
  "telefoane cu butoane": "Feature phones", "кнопочный телефон": "Feature phones", "кнопочные телефоны": "Feature phones",
  "persoană fizică": "Private seller", "частное лицо": "Private seller", "private": "Private seller", "shop": "Shop",
  "gray": "Grey", "черный": "Black", "зеленый": "Green", "natural titanium": "Natural Titanium",
  "starea bateriei": "Battery health", "capacitatea bateriei, %": "Battery health",
  "да": "Yes", "нет": "No",
};
for (const [alias, en] of Object.entries(additionalAliases)) aliases.set(alias, en);
const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
const patterns = Object.entries(messages).filter(([en]) => en.includes("{0}")).map(([source, values]) => {
  const en = normalize(source);
  const ids: number[] = [];
  let expression = "", cursor = 0;
  for (const match of en.matchAll(/\{(\d+)\}/g)) {
    expression += escape(en.slice(cursor, match.index)) + "(.+?)";
    ids.push(Number(match[1])); cursor = match.index! + match[0].length;
  }
  expression += escape(en.slice(cursor));
  return { regex: new RegExp("^" + expression + "$", "i"), ids, en, values };
}).sort((a,b) => b.en.replace(/\{\d+\}/g, "").length - a.en.replace(/\{\d+\}/g, "").length);
export function translate(text: string, locale: Language = language, depth = 0): string {
  if (!text.trim() || depth > 5) return text;
  const clean = normalize(text);
  const canonicalLabel = specificationLabel(clean);
  const canonical = Object.hasOwn(messages, clean) ? clean : exactAliases.get(clean) || aliases.get(clean.toLowerCase()) || aliases.get(canonicalLabel.toLowerCase());
  const render = (en: string, values: [string, string]) => locale === "en" ? en : values[locale === "ro" ? 0 : 1];
  let result: string | undefined;
  if (canonical && messages[canonical]) result = render(canonical, messages[canonical]);
  if (result === undefined) {
    for (const pattern of patterns) {
      const match = pattern.regex.exec(clean);
      if (!match) continue;
      const args: Record<number, string> = {};
      pattern.ids.forEach((id, index) => { args[id] = translate(match[index + 1], locale, depth + 1); });
      result = render(pattern.en, pattern.values).replace(/\{(\d+)\}/g, (_, id) => args[Number(id)]);
      break;
    }
  }
  // Composed metadata and validation summaries keep their original separators.
  if (result === undefined && / · | — |\n/.test(text)) return text.split(/( · | — |\n)/).map((part, index) => index % 2 ? part : translate(part, locale, depth + 1)).join("");
  if (result === undefined && /(?<=[.!?]) (?=[A-Z])/.test(clean)) return clean.split(/(?<=[.!?]) (?=[A-Z])/).map(part => translate(part, locale, depth + 1)).join(" ");
  if (result === undefined) return text;
  return (text.match(/^\s*/)?.[0] || "") + result + (text.match(/\s*$/)?.[0] || "");
}
