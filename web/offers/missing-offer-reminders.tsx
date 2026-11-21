import { useId, useState } from "react";
import { Check, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import type { OfferDraft } from "../../shared/offer-draft";
import { saveSaleDetails, type Device } from "../storage";
import { missingPublications, parsePnl } from "./missing-publications";
import { marketplaceNickname } from "./marketplace-identity";
import "./missing-offer-reminders.css";

type Reminder = {
  id: string;
  title: string;
  accounts: string[];
  draft?: boolean;
  otherCopies?: boolean;
  onConfirm: (profit: number) => Promise<void>;
};

function MissingOfferCard({ reminder, expanded, onToggle }: {
  reminder: Reminder;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { title, accounts, draft, otherCopies, onConfirm } = reminder;
  const content = useId();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="missing-offer-card">
      <button type="button" className="missing-offer-toggle" aria-expanded={expanded} aria-controls={content} onClick={onToggle}>
        <CircleAlert aria-hidden="true" />
        <span translate="no">
          <strong>{title}</strong>
          <small>{accounts.map(marketplaceNickname).join(", ")}</small>
        </span>
        <ChevronDown className="missing-offer-chevron" aria-hidden="true" />
      </button>
      <form id={content} className="missing-offer-form" hidden={!expanded} aria-label={"Close disappeared offer " + title} onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        try {
          const profit = parsePnl(amount);
          setBusy(true);
          setError("");
          await onConfirm(profit);
        } catch (error) {
          setError((error as Error).message);
          setBusy(false);
        }
      }}>
        {draft ? <p>Your draft is still here. Record the result to close it.</p> : <p>If you sold this device, record the profit.</p>}
        <div className="missing-offer-pnl">
          <span>Profit</span>
          <label>
            <input aria-label={"Profit for " + title} inputMode="decimal" placeholder="0" value={amount} maxLength={18} disabled={busy} onChange={e => setAmount(e.target.value)} />
            <span>MDL</span>
          </label>
        </div>
        {otherCopies && <p>Other account copies may still be active.</p>}
        {error && <p role="alert">{error}</p>}
        <button className="missing-offer-confirm" type="submit" disabled={busy || !amount.trim()}>
          {busy ? <LoaderCircle className="spinning" aria-hidden="true" /> : <Check aria-hidden="true" />}
          {draft ? "Confirm & remove draft" : "Record sale"}
        </button>
      </form>
    </article>
  );
}

export function MissingOfferReminders({ drafts, devices, missingDevices, onConfirm, onSaved, excludedDraftId, separate }: {
  drafts: OfferDraft[];
  devices: Device[];
  missingDevices: Device[];
  onConfirm: (draft: OfferDraft, profit: number) => Promise<void>;
  onSaved?: () => Promise<void>;
  excludedDraftId?: string;
  separate: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const reminders: Reminder[] = [
    ...drafts.flatMap(draft => {
      if (draft.id === excludedDraftId) return [];
      const missing = missingPublications(draft, devices);
      if (!missing.length) return [];
      return [{
        id: "draft:" + draft.id,
        title: draft.title || draft.model,
        accounts: missing.map(publication => publication.login),
        draft: true,
        otherCopies: (draft.publications?.length ?? 0) > missing.length,
        onConfirm: (profit: number) => onConfirm(draft, profit),
      }];
    }),
    ...missingDevices.map(device => ({
      id: "device:" + device.id,
      title: device.title || device.model || "Device",
      accounts: device.monitoredAccount ? [device.monitoredAccount] : [],
      onConfirm: async (profit: number) => {
        await saveSaleDetails(device.id, "sold", profit, true);
        await onSaved?.();
      },
    })),
  ];
  if (!reminders.length) return null;
  return (
    <section className="missing-offer-reminders">
      <h2>Removed from 999.md</h2>
      <div className="missing-offer-stack">
        {reminders.map(reminder => (
          <MissingOfferCard
            key={reminder.id}
            reminder={reminder}
            expanded={openId === reminder.id}
            onToggle={() => setOpenId(current => current === reminder.id ? null : reminder.id)}
          />
        ))}
      </div>
      {separate && <hr className="missing-offer-divider" />}
    </section>
  );
}
