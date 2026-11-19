import type { Device } from "./storage";

export const fieldKey = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
const fields = {
  brand: ["Brand", "Marcă", "Марка"],
  model: ["Model", "Модель"],
  storage: [
    "Storage",
    "Memorie încorporată",
    "Memorie internă",
    "Встроенная память",
    "Объем памяти",
  ],
  ram: ["RAM", "Memorie RAM", "Оперативная память", "ОЗУ"],
  operatingSystem: [
    "Operating system",
    "Sistem de operare",
    "Операционная система",
    "OS",
  ],
  deviceType: [
    "Device type",
    "Tip dispozitiv",
    "Tipul dispozitivului",
    "Тип устройства",
  ],
  color: ["Color", "Colour", "Culoare", "Цвет"],
  condition: ["Condition", "Stare", "Состояние"],
  batteryHealth: [
    "Battery health",
    "Capacitatea bateriei, %",
    "Состояние аккумулятора, %",
    "Емкость аккумулятора, %",
  ],
  batteryCapacity: [
    "Battery capacity",
    "Battery capacity mAh",
    "Capacitatea bateriei, mAh",
    "Емкость аккумулятора, мАч",
    "Емкость батареи",
  ],
  sellerType: ["Seller type", "Autorul anunțului", "Автор объявления"],
  location: [
    "Location",
    "City",
    "Oraș",
    "Localitate",
    "Город",
    "Местоположение",
    "Регион",
  ],
  category: ["Category", "Categorie", "Категория"],
  screenSize: ["Screen size", "Diagonală ecran", "Диагональ экрана"],
  refreshRate: [
    "Refresh rate",
    "Frecvența ecran",
    "Frecvență ecran",
    "Частота экрана",
    "Частота обновления экрана",
  ],
  resolution: ["Resolution", "Rezoluție ecran", "Разрешение экрана"],
  processor: ["Processor", "Procesor", "Процессор"],
  nfc: ["NFC"],
  network: ["Network", "Rețea", "Стандарт связи"],
  sim: ["SIM", "SIM cards", "Număr SIM", "Количество SIM-карт"],
  accessories: ["Accessories", "Accesorii", "Комплектация"],
  warranty: ["Warranty", "Garanție", "Гарантия"],
} satisfies Record<string, string[]>;
const names: Record<string, string> = {
  category: "Category",
  screenSize: "Screen size",
  refreshRate: "Refresh rate",
  resolution: "Resolution",
  processor: "Processor",
  nfc: "NFC",
  network: "Network",
  sim: "SIM cards",
  accessories: "Accessories",
  warranty: "Warranty",
};
const core = new Set([
  "brand",
  "model",
  "storage",
  "ram",
  "operatingSystem",
  "deviceType",
  "color",
  "condition",
  "batteryHealth",
  "batteryCapacity",
  "sellerType",
  "location",
]);
const aliases = new Map(
  Object.entries(fields).flatMap(([key, labels]) =>
    [...labels, key].map((label) => [fieldKey(label), key] as const),
  ),
);
const coreNames: Record<string, string> = { brand: "Brand", model: "Model", storage: "Storage", ram: "RAM", operatingSystem: "Operating system", deviceType: "Device type", color: "Colour", condition: "Condition", batteryHealth: "Battery health", batteryCapacity: "Battery capacity", sellerType: "Seller type", location: "Location" };
export function specificationLabel(label: string) {
  const key = aliases.get(fieldKey(label));
  return (key && (coreNames[key] || names[key])) || label;
}
const propertyAliases: Record<string, string[]> = {
  batteryCapacity: ["batteryCapacityMah", "batteryCapacity"],
  location: ["location", "city"],
  sellerType: ["sellerType", "authorType"],
};
const scalar = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean"
    ? String(value).trim()
    : "";
type Specification = { key: string; label: string; value: string };
const indexes = new WeakMap<Device, Map<string, Specification>>();
function specifications(device: Device) {
  let index = indexes.get(device);
  if (index) return index;
  index = new Map();
  const raw = device.rawCharacteristics;
  const entries = device.characteristics?.length
    ? device.characteristics
    : raw && typeof raw === "object" && !Array.isArray(raw)
      ? Object.entries(raw).map(([label, value]) => ({
          label,
          value: scalar(value),
        }))
      : [];
  for (const { label, value } of entries) {
    if (!scalar(value)) continue;
    const key = aliases.get(fieldKey(label)) || fieldKey(label);
    if (key && !index.has(key))
      index.set(key, {
        key,
        label: Object.hasOwn(names, key) ? names[key] : label.trim(),
        value: scalar(value),
      });
  }
  for (const key of Object.keys(names)) {
    const value = scalar(device[key]) || scalar(device.source?.[key]);
    if (value) index.set(key, { key, label: names[key], value });
  }
  indexes.set(device, index);
  return index;
}
export function inventoryField(device: Device, key: string) {
  const properties = Object.hasOwn(propertyAliases, key)
    ? propertyAliases[key]
    : [key];
  for (const property of properties)
    if (device.overrides && Object.hasOwn(device.overrides, property))
      return scalar(device.overrides[property]);
  for (const property of properties) {
    const value = scalar(device[property]);
    if (value) return value;
  }
  for (const property of properties) {
    const value = scalar(device.source?.[property]);
    if (value) return value;
  }
  return specifications(device).get(key)?.value || "";
}
export function fieldValueKey(key: string, value: unknown) {
  const text = fieldKey(value);
  if (key === "storage" || key === "ram")
    return text
      .replace(/гб|гигабайт(?:а|ов)?/g, "gb")
      .replace(/тб|терабайт(?:а|ов)?/g, "tb");
  if (key === "condition")
    return /^(new|nou|noua|новый|новое|новая|unused|neutilizat|nefolosit)$/.test(
      text,
    )
      ? "new"
      : /^(used|utilizat|бу|folosit|подерж)/.test(text)
        ? "used"
        : text;
  if (key === "sellerType")
    return /^(shop|store|magazin|магазин)$/.test(text)
      ? "shop"
      : /private|particular|persoanafizica|физическоелицо|частноелицо|частный/.test(
            text,
          )
        ? "private"
        : text;
  if (key === "deviceType")
    return /^(smartphoneuri|smartphone|smartphones|смартфоны|смартфон)$/.test(
      text,
    )
      ? "smartphone"
      : /telefoanecubutoane|кнопочные|кнопочный/.test(text)
        ? "featurephone"
        : text;
  if (key === "color") {
    const groups = [
      "black negru черный",
      "white alb белый",
      "blue albastru синий",
      "green verde зеленый",
      "gray grey gri серый",
      "silver argintiu серебристый",
      "gold auriu золотой",
      "red rosu красный",
      "pink roz розовый",
      "purple violet фиолетовый",
      "naturaltitanium titannatural натуральныйтитан",
    ];
    return (
      groups.find((group) => group.split(" ").includes(text))?.split(" ")[0] ||
      text
    );
  }
  return text;
}
export function fieldMatches(key: string, actual: string, expected: string) {
  if (key === "location")
    return (
      !!actual &&
      fieldValueKey(key, actual).includes(fieldValueKey(key, expected))
    );
  return fieldValueKey(key, actual) === fieldValueKey(key, expected);
}
export function numericField(
  device: Device,
  key: "batteryHealth" | "batteryCapacity",
) {
  const text = inventoryField(device, key);
  if (!text || (key === "batteryCapacity" && /%/.test(text))) return null;
  if (key === "batteryCapacity") {
    if (/\bAh\b/i.test(text) && !/mAh/i.test(text)) return null;
    const digits = text.replace(/\s+/g, "").replace(/(?:mAh|мАч)$/iu, "");
    if (!/^(?:\d+|\d{1,3}(?:[,.]\d{3})+)$/.test(digits)) return null;
    const value = Number(digits.replace(/[,.]/g, ""));
    return value > 0 ? value : null;
  }
  const value = Number(text.replace(/%/g, "").replace(",", ".").trim());
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
export function inventoryOptions(
  devices: Device[],
  key: string,
  presets: string[] = [],
) {
  const values = new Map<string, string>();
  for (const value of [
    ...devices.map((d) => inventoryField(d, key)),
    ...presets,
  ])
    if (value && !values.has(fieldValueKey(key, value)))
      values.set(fieldValueKey(key, value), value.trim());
  return [...values.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}
export function extraSpecifications(devices: Device[]) {
  const result = new Map<
    string,
    { key: string; label: string; values: Map<string, string> }
  >();
  for (const device of devices)
    for (const entry of specifications(device).values()) {
      if (core.has(entry.key)) continue;
      const value = inventoryField(device, entry.key);
      if (!value) continue;
      let group = result.get(entry.key);
      if (!group) {
        group = { key: entry.key, label: entry.label, values: new Map() };
        result.set(entry.key, group);
      }
      group.values.set(fieldKey(value), value);
    }
  return [...result.values()]
    .map((group) => ({
      ...group,
      values: [...group.values.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
