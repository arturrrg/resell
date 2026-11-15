import { useState } from "react";
import { CircleAlert, Check, LoaderCircle } from "lucide-react";
import type { OfferDraft } from "../../shared/offer-draft";
import type { Device } from "../storage";
import { missingPublications, parsePnl } from "./missing-publications";
import { marketplaceNickname } from "./marketplace-identity";

function MissingOffer({ draft, devices, onConfirm }: { draft: OfferDraft; devices: Device[]; onConfirm: (draft: OfferDraft, profit: number) => Promise<void> }) {
  const [amount, setAmount] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const missing = missingPublications(draft, devices);
  if (!missing.length) return null;
  return <form className="missing-offer-reminder" aria-label={"Close disappeared offer " + draft.title} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    try { const profit = parsePnl(amount); setBusy(true); setError(""); await onConfirm(draft, profit); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }}>
    <div className="missing-offer-heading"><CircleAlert /><div><strong>Offer no longer on 999.md</strong><span>{draft.title || draft.model} · {missing.map(p => marketplaceNickname(p.login)).join(", ")}</span></div></div>
    <p>Your draft is still here. Record the result to close it.</p>
    <div className="missing-offer-pnl"><span className="pnl-label">Profit</span><label><span className="sr-only">Profit in MDL</span><input aria-label={"Profit for " + draft.title} inputMode="decimal" placeholder="0" value={amount} maxLength={18} disabled={busy} onChange={e => setAmount(e.target.value)} /><span>MDL</span></label></div>
    {(draft.publications?.length || 0) > missing.length && <p>Other account copies may still be active.</p>}
    {error && <p role="alert">{error}</p>}
    <button className="missing-offer-confirm" type="submit" disabled={busy || !amount.trim()}>{busy ? <LoaderCircle className="spinning" /> : <Check />}Confirm & remove draft</button>
  </form>;
}
export function MissingOfferReminders({ drafts, devices, onConfirm, excludedDraftId }: { drafts: OfferDraft[]; devices: Device[]; onConfirm: (draft: OfferDraft, profit: number) => Promise<void>; excludedDraftId?: string }) {
  return <div className="missing-offer-reminders">{drafts.filter(d => d.id !== excludedDraftId && missingPublications(d, devices).length > 0).map(draft => <MissingOffer key={draft.id} draft={draft} devices={devices} onConfirm={onConfirm} />)}</div>;
}
