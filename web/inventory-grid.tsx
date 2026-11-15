import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Device } from "./storage";

/** Search and sorting cover every record; only nearby cards need mounted controls. */
export function InventoryGrid({
  devices,
  resetKey,
  renderCard,
  retainPaint = false,
}: {
  devices: Device[];
  resetKey: string;
  renderCard: (device: Device) => ReactNode;
  retainPaint?: boolean;
}) {
  const [page, setPage] = useState({ key: resetKey, limit: 18 });
  const limit = page.key === resetKey ? page.limit : 18;
  const more = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = grid.current;
    const pane = section?.closest(".inventory-page");
    if (!section || !pane || !retainPaint) return;
    // Keep the vertically visible cards painted while their workspace moves
    // horizontally offscreen. content-visibility:auto otherwise drops their
    // image surfaces and exposes a blank repaint on a quick return swipe.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const bounds = entry.rootBounds;
          if (!bounds) continue;
          const keep =
            entry.boundingClientRect.bottom >= bounds.top &&
            entry.boundingClientRect.top <= bounds.bottom;
          if (entry.target.getAttribute("data-paint-retained") !== String(keep))
            entry.target.setAttribute("data-paint-retained", String(keep));
        }
      },
      { root: pane, rootMargin: "240px 0px" },
    );
    section
      .querySelectorAll(":scope>article")
      .forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [devices, limit, retainPaint]);
  useEffect(() => {
    const node = more.current;
    if (!node || limit >= devices.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setPage({ key: resetKey, limit: limit + 18 });
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [devices.length, limit, resetKey]);
  return (
    <>
      <section className="inventory" ref={grid}>
        {devices.slice(0, limit).map(renderCard)}
      </section>
      {limit < devices.length && (
        <div ref={more} className="inventory-more" aria-hidden="true" />
      )}
    </>
  );
}
