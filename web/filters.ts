import type { Device } from "./storage";
import { translate } from "./i18n";
import type { ExchangeRates } from "../shared/exchange";
import {
  inventoryField,
  fieldMatches,
  numericField,
  fieldKey,
  fieldValueKey,
} from "./inventory-fields";
export type InventoryFilters = {
  brand: string;
  storage: string;
  condition: string;
  status: string;
  media: string;
  battery: string;
  batteryMax: string;
  min: string;
  max: string;
  sort: string;
  model: string;
  ram: string;
  operatingSystem: string;
  deviceType: string;
  color: string;
  sellerType: string;
  sellerName: string;
  location: string;
  currency: string;
  capacityMin: string;
  capacityMax: string;
  profitMin: string;
  profitMax: string;
  specifications: Record<string, string>;
};
export const emptyFilters: InventoryFilters = {
  brand: "",
  storage: "",
  condition: "",
  status: "",
  media: "",
  battery: "",
  batteryMax: "",
  min: "",
  max: "",
  sort: "recent",
  model: "",
  ram: "",
  operatingSystem: "",
  deviceType: "",
  color: "",
  sellerType: "",
  sellerName: "",
  location: "",
  currency: "",
  capacityMin: "",
  capacityMax: "",
  profitMin: "",
  profitMax: "",
  specifications: {},
};
export type ScalarFilter = Exclude<keyof InventoryFilters, "specifications">;
export function hasActiveFilters(value: InventoryFilters) {
  return Object.keys(emptyFilters).some((key) =>
    key === "specifications"
      ? Object.values(value.specifications || {}).some(Boolean)
      : value[key as ScalarFilter] !== emptyFilters[key as ScalarFilter],
  );
}
export const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .trim();
export function conditionGroup(value: unknown) {
  return fieldValueKey("condition", value);
}
export function mdlPrice(device: Device, rates: ExchangeRates | null) {
  const price = device.sourcePrice ?? device.askingPrice;
  if (price == null || !Number.isFinite(Number(price))) return null;
  const currency = String(device.currency || "MDL").toUpperCase();
  if (currency === "MDL") return Number(price);
  const rate =
    currency === "EUR"
      ? rates?.mdlPerEur
      : currency === "USD"
        ? rates?.mdlPerUsd
        : undefined;
  return rate ? Number(price) * rate : null;
}
// Inventory writes and reconciliation replace changed objects. A weak index
// avoids rebuilding long descriptions on every keystroke and releases deleted cards.
const searchIndex = new WeakMap<Device, string>();
function searchable(device: Device) {
  let text = searchIndex.get(device);
  if (text === undefined) {
    text = [
      device.brand,
      device.model,
      device.title,
      device.storage,
      device.color,
      device.sellerName,
      device.listingDescription,
      ...["ram", "operatingSystem", "deviceType", "location", "phone"].map(
        (key) => inventoryField(device, key),
      ),
      ...(device.characteristics || []).map((c) => c.value),
      ...[device.color, device.condition, ...["deviceType", "sellerType"].map(key => inventoryField(device, key)), ...(device.characteristics || []).map(c => c.value)]
        .filter((value): value is string => typeof value === "string")
        .flatMap(value => [translate(value, "en"), translate(value, "ro"), translate(value, "ru")]),
    ]
      .join(" ")
      .toLocaleLowerCase();
    searchIndex.set(device, text);
  }
  return text;
}
export function filterInventory(
  devices: Device[],
  filters: InventoryFilters,
  query: string,
  rates: ExchangeRates | null,
) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const fieldFilters = (
    [
      "brand",
      "model",
      "storage",
      "ram",
      "operatingSystem",
      "deviceType",
      "color",
      "sellerType",
      "sellerName",
      "location",
    ] as const
  ).filter((key) => filters[key]);
  const specificationFilters = Object.entries(
    filters.specifications || {},
  ).filter(([, value]) => !!value);
  return devices
    .filter((d) => {
      const price = mdlPrice(d, rates);
      const health =
        filters.battery || filters.batteryMax
          ? numericField(d, "batteryHealth")
          : null;
      const capacity =
        filters.capacityMin || filters.capacityMax
          ? numericField(d, "batteryCapacity")
          : null;
      return (
        (!terms.length ||
          terms.every((term) => searchable(d).includes(term))) &&
        fieldFilters.every((key) =>
          fieldMatches(key, inventoryField(d, key), filters[key]),
        ) &&
        (!filters.condition ||
          fieldMatches(
            "condition",
            inventoryField(d, "condition"),
            filters.condition,
          )) &&
        (!filters.status ||
          (d.saleStatus || "in_progress") === filters.status) &&
        (!filters.media ||
          (filters.media === "video"
            ? !!d.videos?.length
            : !d.videos?.length)) &&
        (!filters.battery ||
          (health !== null && health >= Number(filters.battery))) &&
        (!filters.batteryMax ||
          (health !== null && health <= Number(filters.batteryMax))) &&
        (!filters.currency ||
          String(d.currency || "MDL").toUpperCase() === filters.currency) &&
        (!filters.capacityMin ||
          (capacity !== null && capacity >= Number(filters.capacityMin))) &&
        (!filters.capacityMax ||
          (capacity !== null && capacity <= Number(filters.capacityMax))) &&
        (!filters.profitMin ||
          (d.expectedProfit != null &&
            d.expectedProfit >= Number(filters.profitMin))) &&
        (!filters.profitMax ||
          (d.expectedProfit != null &&
            d.expectedProfit <= Number(filters.profitMax))) &&
        specificationFilters.every(
          ([key, value]) =>
            fieldKey(inventoryField(d, key)) === fieldKey(value),
        ) &&
        (!filters.min || (price !== null && price >= Number(filters.min))) &&
        (!filters.max || (price !== null && price <= Number(filters.max)))
      );
    })
    .sort((a, b) =>
      filters.sort === "price"
        ? (mdlPrice(a, rates) ?? Infinity) - (mdlPrice(b, rates) ?? Infinity)
        : filters.sort === "price-desc"
          ? (mdlPrice(b, rates) ?? -Infinity) -
            (mdlPrice(a, rates) ?? -Infinity)
          : filters.sort === "profit"
            ? (b.expectedProfit ?? -Infinity) - (a.expectedProfit ?? -Infinity)
            : String(b.createdAt || "").localeCompare(
                String(a.createdAt || ""),
              ),
    );
}
