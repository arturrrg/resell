import type { OfferDraft } from "../../shared/offer-draft";
import type { QueueEntry } from "./preparation-queue";

export function preparationAccounts(draft: OfferDraft, accounts: { id: string; login: string }[]) {
  return accounts.map(account => ({ ...account, price: draft.accountPrices?.[account.id]?.trim() || draft.price, currency: draft.currency }));
}
export function preparationDraft(draft: OfferDraft, entry: Pick<QueueEntry, "price" | "currency">): OfferDraft {
  return { ...draft, price: entry.price ?? draft.price, currency: entry.currency ?? draft.currency };
}
