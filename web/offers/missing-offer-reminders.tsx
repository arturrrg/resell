import { useState } from "react";
import { CircleAlert, Check, LoaderCircle } from "lucide-react";
import type { OfferDraft } from "../../shared/offer-draft";
import { all, saveSaleDetails, type Device } from "../storage";
import { Sheet } from "../sheet";
import { closeDisappearedDraft } from "./draft-store";
import { missingMonitoredDevices, missingPublications, parsePnl } from "./missing-publications";
import { marketplaceNickname } from "./marketplace-identity";
import "./missing-offer-reminders.css";

export function MissingOfferForm({ title, accounts, onConfirm, draft, otherCopies, showHeading = true }: {
  title: string;
  accounts: string[];
  onConfirm: (profit: number) => Promise<void>;
  draft?: boolean;
  otherCopies?: boolean;
  showHeading?: boolean;
}) {
  const [amount, setAmount] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="missing-offer-reminder" aria-label={"Close disappeared offer " + title} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    try { const profit = parsePnl(amount); setBusy(true); setError(""); await onConfirm(profit); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }}>
    <div className="missing-offer-heading"><CircleAlert /><div>{showHeading && <strong>Offer no longer on 999.md</strong>}<span>{title} · {accounts.map(marketplaceNickname).join(", ")}</span></div></div>
    {draft ? <p>Your draft is still here. Record the result to close it.</p> : <p>If you sold this device, record the profit.</p>}
    <div className="missing-offer-pnl"><span className="pnl-label">Profit</span><label><span className="sr-only">Profit in MDL</span><input aria-label={"Profit for " + title} inputMode="decimal" placeholder="0" value={amount} maxLength={18} disabled={busy} onChange={e => setAmount(e.target.value)} /><span>MDL</span></label></div>
    {otherCopies && <p>Other account copies may still be active.</p>}
    {error && <p role="alert">{error}</p>}
    <button className="missing-offer-confirm" type="submit" disabled={busy || !amount.trim()}>{busy ? <LoaderCircle className="spinning" /> : <Check />}{draft ? "Confirm & remove draft" : "Record sale"}</button>
  </form>;
}

export function MissingOfferReminders({ drafts, devices, onConfirm, excludedDraftId }: { drafts: OfferDraft[]; devices: Device[]; onConfirm: (draft: OfferDraft, profit: number) => Promise<void>; excludedDraftId?: string }) {
  return <div className="missing-offer-reminders">{drafts.filter(draft => draft.id !== excludedDraftId).map(draft => {
    const missing = missingPublications(draft, devices);
    return missing.length > 0 && <MissingOfferForm key={draft.id} title={draft.title || draft.model} draft accounts={missing.map(publication => publication.login)} otherCopies={(draft.publications?.length ?? 0) > missing.length} onConfirm={profit => onConfirm(draft, profit)} />;
  })}</div>;
}

export function MissingInventorySales({ scope, drafts, devices, external, verifying, canPrompt, onSaved }: {
  scope: string;
  drafts: OfferDraft[];
  devices: Device[];
  external: boolean;
  verifying: boolean;
  canPrompt: boolean;
  onSaved: () => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  if (verifying) return null;
  const reminds = [
    ...drafts.flatMap(draft => {
      const missing = missingPublications(draft, devices);
      if (!missing.length) return [];
      return [{
        id: draft.id,
        title: draft.title || draft.model,
        accounts: missing.map(publication => publication.login),
        draft: true,
        otherCopies: (draft.publications?.length ?? 0) > missing.length,
        onConfirm: async (profit: number) => {
          if (!missingPublications(draft, await all()).length)
            throw Error("This offer is public again. Its draft was kept.");
          await closeDisappearedDraft(draft.id, scope, profit);
        },
      }];
    }),
    ...missingMonitoredDevices(drafts, devices, external).map(device => ({
      id: device.id,
      title: device.title || device.model || "Device",
      accounts: [device.monitoredAccount!],
      onConfirm: async (profit: number) => {
        await saveSaleDetails(device.id, "sold", profit, true);
        await onSaved();
      },
    })),
  ];
  const pending = canPrompt ? reminds.filter(offer => !dismissed.has(offer.id)) : [];
  if (pending.length) return (
    <Sheet title="Offer no longer on 999.md" onClose={() => setDismissed(previous => new Set([...previous, ...pending.map(offer => offer.id)]))}>
      <div className="missing-offer-reminders">
        {pending.map(({ id, ...offer }) => <MissingOfferForm key={id} {...offer} showHeading={false} />)}
      </div>
    </Sheet>
  );
  return <div className="missing-offer-reminders">
    {reminds.map(({ id, ...offer }) => <MissingOfferForm key={id} {...offer} />)}
  </div>;
}
