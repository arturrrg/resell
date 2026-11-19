import type { OfferDraft } from "../../shared/offer-draft";
import { identity, type Device } from "../storage";
import { publicationIsVisible } from "./publication-presence";

export function missingPublications(draft: OfferDraft, devices: Device[]) {
  if (draft.sale || draft.kind === "template") return [];
  const sources = new Map(devices.map(d => [identity(d.listingUrl || ""), d]));
  return (draft.publications || []).filter(p => p.state === "published" && !publicationIsVisible(sources.get(p.advertId), true));
}
export function parsePnl(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw Error("Enter an amount with up to two decimal places.");
  const amount = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(amount) || amount > 1e9) throw Error("Enter a valid amount.");
  return amount;
}
