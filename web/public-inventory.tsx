import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, ImageOff, LockKeyhole, Play, Search, X } from "lucide-react";
import { viewingCode } from "./sharing";
import { getViewerSupabase } from "./supabase";
import { publicInventoryItems, type PublicInventoryItem } from "./public-inventory-model";
import { availablePublicInventory } from "./public-inventory-availability";
import "./public-inventory.css";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const price = (item: PublicInventoryItem) => item.price === undefined ? "Price on request" : `${number.format(item.price)} ${item.currency}`.trim();
const meta = (item: PublicInventoryItem) => [item.storage, item.color, item.condition, item.battery ? `${item.battery}% battery` : ""].filter(Boolean);

const sortOptions = [{ value: "original", label: "Recently added" }, { value: "low", label: "Price: low to high" }, { value: "high", label: "Price: high to low" }];
function InventorySort({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div className="viewer-sort" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus()); }
      else { const buttons = Array.from(root.current!.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus(); }
    }
  }}><button ref={trigger} className="viewer-sort-trigger" aria-label={`Sort devices: ${sortOptions.find(option => option.value === value)?.label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(current => !current)}>{sortOptions.find(option => option.value === value)?.label}<ChevronDown /></button>
    {open && <div className="viewer-sort-menu" role="menu" aria-label="Sort devices">{sortOptions.map(option => <button key={option.value} role="menuitemradio" aria-checked={value === option.value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>{option.label}{value === option.value && <Check />}</button>)}</div>}
  </div>;
}

export function InventoryCodeEntry() {
  const [value, setValue] = useState(""), [error, setError] = useState("");
  return <main className="viewer-site viewer-entry">
    <div className="viewer-code-panel">
      <a href="/" className="viewer-wordmark" aria-label="Resell home">Resell<span>.</span></a>
      <h1>View inventory.</h1>
      <p>Enter the code shared with you.</p>
      <form onSubmit={event => { event.preventDefault(); const code = viewingCode(value); if (!code) { setError("Enter a valid inventory code or shared link."); return; } location.hash = "view=" + code; }}>
        <label className="viewer-code-field"><span className="viewer-sr-only">Inventory code or link</span><input aria-invalid={!!error} aria-describedby={error ? "viewer-code-error" : undefined} placeholder="Inventory code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={value} onChange={event => { setValue(event.target.value); setError(""); }} required /><button type="submit" aria-label="View inventory"><ArrowRight /></button></label>
        {error && <p id="viewer-code-error" className="viewer-error" role="alert">{error}</p>}
      </form>
    </div>
  </main>;
}

function ProductGallery({ item }: { item: PublicInventoryItem }) {
  const track = useRef<HTMLDivElement>(null), [index, setIndex] = useState(0);
  const media = [...item.photos.map(url => ({ kind: "image" as const, url })), ...item.videos];
  function move(next: number) { const node = track.current; if (node) node.scrollTo({ left: Math.max(0, Math.min(media.length - 1, next)) * node.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
  return <div className="viewer-product-gallery">
    <div className="viewer-media-track" ref={track} onScroll={event => { const node = event.currentTarget; if (node.clientWidth) setIndex(Math.round(node.scrollLeft / node.clientWidth)); }} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(index + (event.key === "ArrowRight" ? 1 : -1)); } }} tabIndex={0} aria-label={`${item.title} photos and videos`}>
      {media.length ? media.map((medium, position) => <div className="viewer-media-slide" key={`${medium.url}-${position}`}>
        {medium.kind === "image" ? <img src={medium.url} alt={`${item.title} · Photo ${position + 1}`} loading={position ? "lazy" : "eager"} /> : medium.kind === "video" ? <video src={position === index ? medium.url : undefined} poster={medium.poster} controls playsInline preload="metadata" /> : position === index ? <iframe src={medium.embedUrl} title={`${item.title} video`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /> : <div className="viewer-media-placeholder"><Play /></div>}
      </div>) : <div className="viewer-media-slide viewer-media-placeholder"><ImageOff /><span>No photos available</span></div>}
    </div>
    {media.length > 1 && <div className="viewer-gallery-controls"><button aria-label="Previous photo" disabled={!index} onClick={() => move(index - 1)}><ChevronLeft /></button><span aria-live="polite">{index + 1}<span> / {media.length}</span></span><button aria-label="Next photo" disabled={index >= media.length - 1} onClick={() => move(index + 1)}><ChevronRight /></button></div>}
  </div>;
}

function ProductDetail({ item, onClose }: { item: PublicInventoryItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; const focused = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; node?.showModal(); document.body.style.overflow = "hidden"; return () => { node?.close(); document.body.style.overflow = overflow; focused?.focus({ preventScroll: true }); }; }, []);
  const fallback = [["Brand", item.brand], ["Model", item.title], ["Storage", item.storage], ["Color", item.color], ["Condition", item.condition], ["Battery health", item.battery ? item.battery + "%" : ""]].filter(([, value]) => value).map(([label, value]) => ({ label, value }));
  return <dialog className="viewer-product-dialog" ref={dialog} aria-label={item.title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <div className="viewer-detail-surface"><button className="viewer-detail-close" onClick={onClose} aria-label="Close device details"><X /></button><ProductGallery item={item} />
      <div className="viewer-detail-copy"><span className="viewer-eyebrow">{item.brand || "Available device"}</span><h2>{item.title}</h2><p className="viewer-detail-meta">{meta(item).join(" · ")}</p><p className="viewer-detail-price">{price(item)}</p>
        {item.sourceUrl && <a className="viewer-source-button" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View on 999.md<ArrowUpRight /></a>}
        {(item.specs.length || fallback.length) > 0 && <section className="viewer-spec-section"><h3>Details</h3><dl>{(item.specs.length ? item.specs : fallback).map((spec, index) => <div key={spec.label + index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></section>}
        {item.description && <section className="viewer-description"><h3>About this device</h3><p>{item.description}</p></section>}
        {item.seller && <p className="viewer-seller">Shared by <strong>{item.seller}</strong></p>}
      </div>
    </div>
  </dialog>;
}

export function PublicInventory({ code, onExit }: { code: string; onExit?: () => void }) {
  const [items, setItems] = useState<PublicInventoryItem[]>([]), [loaded, setLoaded] = useState(false), [error, setError] = useState(""), [query, setQuery] = useState(""), [brand, setBrand] = useState(""), [sort, setSort] = useState("original"), [selectedId, setSelectedId] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false, pending = false;
    const controller = new AbortController();
    setItems([]); setLoaded(false); setError(""); setSelectedId(""); setBrand(""); setQuery("");
    async function load() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const { data, error } = await (await getViewerSupabase()).rpc("resell_view_inventory", { view_code: code }).abortSignal(controller.signal);
        if (error) throw error;
        const next = await availablePublicInventory(publicInventoryItems(data), controller.signal);
        if (!stopped) { setItems(next); setError(""); setLoaded(true); }
      } catch {
        if (!stopped) { setItems([]); setLoaded(true); setError(navigator.onLine ? "This inventory couldn't be opened. Check the code, or ask its owner for a new one." : "You're offline. Connect to the internet and try again."); }
      } finally { pending = false; }
    }
    void load(); const timer = setInterval(() => void load(), 15000);
    const wake = () => void load(); window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    return () => { stopped = true; controller.abort(); clearInterval(timer); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, [code, retry]);
  const brands = useMemo(() => [...new Set(items.map(item => item.brand).filter(Boolean))].sort(), [items]);
  const visible = useMemo(() => {
    const result = items.filter(item => (!brand || item.brand === brand) && [item.title, item.brand, item.storage, item.color].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    if (sort !== "original") result.sort((a, b) => { if (a.price === undefined) return 1; if (b.price === undefined) return -1; return sort === "low" ? a.price - b.price : b.price - a.price; });
    return result;
  }, [items, query, brand, sort]);
  const selected = items.find(item => item.id === selectedId);
  const exit = () => { if (onExit) onExit(); else location.hash = ""; };
  return <main className="viewer-site viewer-inventory">
    <header className="viewer-header"><button className="viewer-wordmark" onClick={exit} aria-label="Enter another inventory code">Resell<span>.</span></button><span className="viewer-readonly"><LockKeyhole />View only</span></header>
    <section className="viewer-collection-heading"><div className="viewer-collection-title"><h1>Inventory<span>.</span></h1><p>{loaded && !error ? `${items.length} ${items.length === 1 ? "device" : "devices"} available` : "Available devices"}</p></div><button className="viewer-back" onClick={exit}><ArrowLeft />Another inventory</button></section>
    {!error && <div className="viewer-collection-tools"><label className="viewer-search"><Search /><span className="viewer-sr-only">Search inventory</span><input placeholder="Search devices" value={query} onChange={event => setQuery(event.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X /></button>}</label>{brands.length > 1 && <nav className="viewer-brand-filters" aria-label="Filter by brand">{["", ...brands].map(value => <button aria-pressed={brand === value} onClick={() => setBrand(value)} key={value}>{brand === value && <Check />}{value || "All devices"}</button>)}</nav>}<InventorySort value={sort} onChange={setSort} /></div>}
    {error ? <section className="viewer-empty"><LockKeyhole /><h2>Unable to open inventory.</h2><p role="alert">{error}</p><button className="viewer-blue-button" onClick={() => setRetry(value => value + 1)}>Try again</button></section> : <section className="viewer-product-grid" aria-label="Available devices" aria-busy={!loaded}>
      {!loaded ? Array.from({ length: 6 }, (_, index) => <div className="viewer-skeleton" key={index}><div /><span /><span /></div>) : visible.map(item => <article className="viewer-product-card" key={item.id}>
        <button className="viewer-card-open" onClick={() => setSelectedId(item.id)} aria-label={`View ${item.title}, ${price(item)}`}><div className="viewer-card-photo">{item.photos[0] ? <img src={item.photos[0]} alt={item.title} loading="lazy" decoding="async" /> : <ImageOff />}{item.photos.length > 1 && <span>{item.photos.length} photos</span>}</div><div className="viewer-card-copy"><span className="viewer-eyebrow">{item.brand || "Device"}</span><h2>{item.title}</h2><p>{meta(item).slice(0, 3).join(" · ")}</p><strong>{price(item)}</strong><span className="viewer-card-arrow" aria-hidden="true"><ArrowUpRight /></span></div></button>
      </article>)}
    </section>}
    {loaded && !error && !visible.length && <section className="viewer-empty"><ImageOff /><h2>{items.length ? "No matching devices." : "More good things soon."}</h2><p>{items.length ? "Try a different search or brand." : "Available devices will appear here when they're shared."}</p>{!!items.length && <button className="viewer-blue-button" onClick={() => { setQuery(""); setBrand(""); }}>Clear filters</button>}</section>}
    <footer className="viewer-footer"><LockKeyhole />Shared for viewing. Always up to date.</footer>
    {selected && <ProductDetail item={selected} onClose={() => setSelectedId("")} />}
  </main>;
}
