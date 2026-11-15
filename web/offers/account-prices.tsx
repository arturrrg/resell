import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { inNativeApp, marketplaceProfile, type MarketplaceProfile } from "./native";
import { marketplaceNickname } from "./marketplace-identity";
import type { OfferDraft } from "../../shared/offer-draft";

export function AccountPrices({ owner, draft, onChange }: { owner: string; draft: OfferDraft; onChange: (prices: Record<string, string>) => void }) {
  const [accounts, setAccounts] = useState<MarketplaceProfile["accounts"]>([]);
  useEffect(() => {
    if (!inNativeApp()) return;
    let alive = true;
    void marketplaceProfile(owner).then(profile => { if (alive) setAccounts(profile.accounts); }).catch(() => {});
    return () => { alive = false; };
  }, [owner]);
  if (accounts.length < 2) return null;
  return <details className="studio-account-prices">
    <summary>Price by account <span>{Object.values(draft.accountPrices || {}).filter(Boolean).length || "Optional"}<ChevronDown aria-hidden="true" /></span></summary>
    <div>{accounts.map(account => <label key={account.id}>
      <span>{marketplaceNickname(account.username || account.login)}</span>
      <input aria-label={`Price for ${account.username || account.login}`} inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" maxLength={24} placeholder={draft.price || "0"} value={draft.accountPrices?.[account.id] || ""}
        onChange={event => { const next = { ...draft.accountPrices }; if (event.target.value) next[account.id] = event.target.value; else delete next[account.id]; onChange(next); }} />
      <small>{draft.currency}</small>
    </label>)}</div>
  </details>;
}
