import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useBackAction } from "../back-navigation";
import type { OfferDraft } from "../../shared/offer-draft";
export function CurrencyPicker({ value, onChange }: { value: OfferDraft["currency"]; onChange: (value: OfferDraft["currency"]) => void }) {
  const [open, setOpen] = useState(false), host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useBackAction(open, () => setOpen(false), 110);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="offer-currency-picker" ref={host}>
    <button type="button" ref={trigger} aria-label={"Currency: " + value} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={event => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => host.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()); }
    }}><span>{value}</span><ChevronDown aria-hidden="true" /></button>
    {open && <div className="offer-currency-menu" role="menu" aria-label="Currency" onKeyDown={event => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")); const at = options.indexOf(document.activeElement as HTMLButtonElement); options[(at + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length]?.focus(); }
    }}>{(["MDL", "EUR", "USD"] as const).map(currency => <button type="button" role="menuitemradio" aria-checked={value === currency} key={currency} onClick={() => { onChange(currency); setOpen(false); trigger.current?.focus(); }}><span>{currency}</span>{value === currency && <Check aria-hidden="true" />}</button>)}</div>}
  </div>;
}
