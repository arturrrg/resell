import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { OfferPhoto } from "../../shared/offer-draft";
import { OfferPhotoImage } from "./photo";
import { moveOfferPhoto } from "./draft-view";
import { selectionFeedback } from "./feedback";
type Drag = {
  id: string;
  from: number;
  to: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  held: boolean;
  timer?: ReturnType<typeof setTimeout>;
};
export function PhotoGrid({
  photos,
  onOpen,
  onReorder,
  children,
}: {
  photos: OfferPhoto[];
  onOpen: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  children?: ReactNode;
}) {
  const grid = useRef<HTMLDivElement>(null),
    ghost = useRef<HTMLDivElement>(null),
    pending = useRef<Drag | null>(null),
    suppress = useRef(false),
    frame = useRef(0),
    lastFeedback = useRef(0);
  const [dragId, setDragId] = useState(""),
    [over, setOver] = useState(-1),
    [announcement, setAnnouncement] = useState("");
  const current = useRef({ photos, onReorder });
  current.current = { photos, onReorder };
  function finish(commit: boolean) {
    const drag = pending.current;
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(frame.current);
    pending.current = null;
    if (drag.held) {
      if (commit && drag.from !== drag.to) {
        const from = current.current.photos.findIndex((p) => p.id === drag.id);
        current.current.onReorder(from, drag.to);
        setAnnouncement("Photo moved to position " + (drag.to + 1));
        selectionFeedback();
      }
      setDragId("");
      setOver(-1);
    }
  }
  function animate() {
    const drag = pending.current;
    if (!drag?.held) return;
    if (ghost.current)
      ghost.current.style.transform =
        "translate3d(" +
        (drag.x - drag.offsetX) +
        "px," +
        (drag.y - drag.offsetY) +
        "px,0) scale(1.04)";
    const scroller = grid.current?.closest<HTMLElement>(".studio-scroll");
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      const speed =
        drag.y < bounds.top + 65
          ? -Math.min(12, (bounds.top + 65 - drag.y) / 5)
          : drag.y > bounds.bottom - 75
            ? Math.min(12, (drag.y - bounds.bottom + 75) / 5)
            : 0;
      if (speed) scroller.scrollTop += speed;
    }
    const tile = document
      .elementFromPoint(drag.x, drag.y)
      ?.closest<HTMLElement>("[data-photo-slot]");
    if (tile && grid.current?.contains(tile)) {
      const to = Number(tile.dataset.photoSlot);
      if (Number.isInteger(to) && to !== drag.to) {
        drag.to = to;
        setOver(to);
        if (performance.now() - lastFeedback.current > 90) {
          selectionFeedback();
          lastFeedback.current = performance.now();
        }
      }
    }
    frame.current = requestAnimationFrame(animate);
  }
  function start(
    event: PointerEvent<HTMLButtonElement>,
    id: string,
    index: number,
  ) {
    if (event.button !== 0) return;
    finish(false);
    suppress.current = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const drag: Drag = {
      id,
      from: index,
      to: index,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
      held: false,
    };
    pending.current = drag;
    drag.timer = setTimeout(() => {
      if (pending.current !== drag) return;
      drag.held = true;
      suppress.current = true;
      setDragId(id);
      setOver(index);
      selectionFeedback();
      setAnnouncement("Photo picked up. Drag to reorder.");
      frame.current = requestAnimationFrame(animate);
    }, 400);
  }
  useEffect(() => {
    const node = grid.current!;
    const touchMove = (event: TouchEvent) => {
      const drag = pending.current;
      if (!drag) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (drag.held) {
        if (event.cancelable) event.preventDefault();
        drag.x = touch.clientX;
        drag.y = touch.clientY;
      } else if (
        Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY) > 9
      )
        finish(false);
    };
    const move = (event: globalThis.PointerEvent) => {
      const drag = pending.current;
      if (!drag) return;
      if (drag.held) {
        drag.x = event.clientX;
        drag.y = event.clientY;
      } else if (
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 9
      )
        finish(false);
    };
    const release = () => finish(true),
      cancel = () => finish(false);
    node.addEventListener("touchmove", touchMove, { passive: false });
    node.addEventListener("touchend", release);
    node.addEventListener("touchcancel", cancel);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      finish(false);
      node.removeEventListener("touchmove", touchMove);
      node.removeEventListener("touchend", release);
      node.removeEventListener("touchcancel", cancel);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const picked = photos.find((photo) => photo.id === dragId),
    drag = pending.current;
  const displayed =
    picked && over >= 0
      ? moveOfferPhoto(
          photos,
          photos.findIndex((p) => p.id === dragId),
          over,
        )
      : photos;
  return (
    <>
      <div
        className={"studio-photo-grid" + (dragId ? " is-reordering" : "")}
        ref={grid}
        onContextMenu={(event) => event.preventDefault()}
      >
        {displayed.map((photo, index) => (
          <button
            key={photo.id}
            className={
              "studio-photo" + (photo.id === dragId ? " is-dragging" : "")
            }
            data-photo-slot={index}
            aria-label={
              "Edit photo " + (index + 1) + (index === 0 ? ", cover" : "")
            }
            aria-describedby="photo-reorder-help"
            onPointerDown={(event) => start(event, photo.id, index)}
            onClick={(event) => {
              if (suppress.current) {
                event.preventDefault();
                suppress.current = false;
                return;
              }
              onOpen(photo.id);
            }}
            onKeyDown={(event) => {
              if (!event.altKey || !event.key.startsWith("Arrow")) return;
              event.preventDefault();
              const delta =
                event.key === "ArrowLeft"
                  ? -1
                  : event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowUp"
                      ? -3
                      : 3;
              const to = index + delta;
              if (to >= 0 && to < photos.length) {
                onReorder(index, to);
                selectionFeedback();
                setAnnouncement("Photo moved to position " + (to + 1));
              }
            }}
          >
            <OfferPhotoImage photo={photo} />
            <span className={index === 0 ? "is-cover" : ""}>
              {index === 0 ? "Cover" : String(index + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
        {children}
      </div>
      <span id="photo-reorder-help" className="sr-only">
        Hold and drag to reorder. With a keyboard use Alt and the arrow keys.
      </span>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {picked &&
        drag?.held &&
        createPortal(
          <div
            ref={ghost}
            className="studio-photo-ghost"
            style={{
              width: drag.width,
              height: drag.height,
              transform:
                "translate3d(" +
                (drag.x - drag.offsetX) +
                "px," +
                (drag.y - drag.offsetY) +
                "px,0) scale(1.04)",
            }}
          >
            <OfferPhotoImage photo={picked} />
          </div>,
          document.body,
        )}
    </>
  );
}
