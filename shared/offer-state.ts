import { newOffer, type OfferDraft } from "./offer-draft";

export function offerState(value: unknown): Pick<OfferDraft, "kind" | "templateName" | "sale" | "publications" | "accountPrices"> {
  const data = value as Partial<OfferDraft>;
  const result: ReturnType<typeof offerState> = {};
  if (data.accountPrices !== undefined) {
    if (!data.accountPrices || Array.isArray(data.accountPrices) || typeof data.accountPrices !== "object" || Object.entries(data.accountPrices).length > 20 || Object.entries(data.accountPrices).some(([id, price]) => !id || id.length > 60 || typeof price !== "string" || price.length > 24)) throw Error("Invalid account prices.");
    result.accountPrices = Object.fromEntries(Object.entries(data.accountPrices));
  }
  if (data.kind !== undefined) {
    if (!["offer", "template"].includes(data.kind)) throw Error("Invalid offer type.");
    result.kind = data.kind;
  }
  if (data.templateName !== undefined) {
    if (typeof data.templateName !== "string" || data.templateName.length > 100) throw Error("Invalid template name.");
    result.templateName = data.templateName;
  }
  if (data.sale !== undefined) {
    if (!data.sale || !Number.isFinite(data.sale.profit) || Math.abs(data.sale.profit) > 1e9 || !Number.isFinite(Date.parse(data.sale.soldAt))) throw Error("Invalid sale.");
    if ((data.sale.closed !== undefined && typeof data.sale.closed !== "boolean") || (data.sale.sourceDraftId !== undefined && !/^[a-f0-9-]{36}$/.test(data.sale.sourceDraftId))) throw Error("Invalid closed sale.");
    result.sale = { profit: data.sale.profit, soldAt: data.sale.soldAt, ...(data.sale.closed !== undefined ? { closed: data.sale.closed } : {}), ...(data.sale.sourceDraftId ? { sourceDraftId: data.sale.sourceDraftId } : {}) };
  }
  if (data.publications !== undefined) {
    if (!Array.isArray(data.publications) || data.publications.length > 100 || data.publications.some(p => !p || !/^[1-9]\d{5,11}$/.test(p.advertId) || typeof p.accountId !== "string" || p.accountId.length > 60 || typeof p.login !== "string" || p.login.length > 100 || !["published", "submitted"].includes(p.state))) throw Error("Invalid published offers.");
    if (data.publications.some(p => (p.price !== undefined && (typeof p.price !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(p.price) || Number(p.price.replace(",", ".")) <= 0)) || (p.currency !== undefined && !["MDL", "EUR", "USD"].includes(p.currency)))) throw Error("Invalid publication price.");
    result.publications = data.publications.map(p => ({ advertId: p.advertId, accountId: p.accountId, login: p.login, state: p.state, ...(p.price !== undefined ? { price: p.price } : {}), ...(p.currency !== undefined ? { currency: p.currency } : {}) }));
  }
  return result;
}

export function fromTemplate(template: OfferDraft): OfferDraft {
  const fresh = newOffer();
  const { kind, templateName, sale, publications, ...fields } = template;
  return { ...fields, id: fresh.id, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, photos: [] };
}
/** Templates hold reusable text and specifications, never product photographs. */
export function templateFields<T extends { kind?: string; photos: unknown[] }>(draft: T): T {
  return draft.kind === "template" && draft.photos.length ? { ...draft, photos: [] } : draft;
}
export function asTemplate(draft: OfferDraft, name: string): OfferDraft {
  const next = fromTemplate(draft);
  return { ...next, kind: "template", templateName: name.trim().slice(0, 100) || draft.title || "Phone template" };
}
