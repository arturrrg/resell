import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useLanguage, setLanguage, type Language } from "./i18n";
import { useBackAction } from "./back-navigation";
import "./language-picker.css";

const languages: [Language, string][] = [["en", "English"], ["ro", "Română"], ["ru", "Русский"]];
export function LanguagePicker({ workspace = false, iconOnly = false }: { workspace?: boolean; iconOnly?: boolean }) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false), id = useId();
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }); };
  useBackAction(open, () => close(true), 120);
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const node = menu.current;
    // Render above the Account sheet without clipping its rounded settings group.
    node.showPopover();
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const width = Math.min(224, innerWidth - 24), height = node.offsetHeight;
      const viewportHeight = window.visualViewport?.height || innerHeight;
      setPosition({ width, left: Math.max(12, Math.min(rect.right - width, innerWidth - width - 12)), top: Math.max(12, rect.bottom + height + 8 <= viewportHeight ? rect.bottom + 6 : rect.top - height - 6) });
    };
    place();
    if (keyboard.current) node.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    keyboard.current = false;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) close(); };
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    document.addEventListener("pointerdown", dismiss);
    return () => { if (node.matches(":popover-open")) node.hidePopover(); window.removeEventListener("resize", place); window.visualViewport?.removeEventListener("resize", place); document.removeEventListener("pointerdown", dismiss); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const scrolled = (event: Event) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) close(); };
    document.addEventListener("scroll", scrolled, true);
    return () => document.removeEventListener("scroll", scrolled, true);
  }, [open]);
  return <div className={`language-picker${workspace ? " language-picker-workspace" : ""}${iconOnly ? " language-picker-compact" : ""}`} ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }} onBlur={event => { if (open && !event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <button type="button" className="language-picker-trigger" ref={trigger} data-language={language} aria-label="Language" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { keyboard.current = false; setOpen(!open); }}
      onContextMenu={workspace ? event => event.preventDefault() : undefined}
      onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); keyboard.current = true; setOpen(true); } }}>
      {iconOnly ? <Languages aria-hidden="true" /> : <>
        {workspace && <span className="language-picker-icon"><Languages aria-hidden="true" /></span>}
        <span className="language-picker-label">Language</span>
        <span className="language-picker-value" translate="no">{languages.find(([value]) => value === language)![1]}</span>
        <ChevronDown className="language-picker-chevron" aria-hidden="true" />
      </>}
    </button>
    {open && <div className="language-picker-menu" id={id} role="menu" aria-label="Language" popover="manual" ref={menu} style={position} onKeyDown={event => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>("button"));
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      items[next]?.focus();
    }}>
      {languages.map(([value, label]) => <button type="button" role="menuitemradio" aria-checked={language === value} lang={value} translate="no" data-language={value} key={value}
        onClick={() => { setLanguage(value); close(true); }}><span>{label}</span>{language === value && <Check aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
