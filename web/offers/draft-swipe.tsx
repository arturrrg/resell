import { useEffect, useRef, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { selectionFeedback } from "./feedback";
export const DRAFT_ACTION_WIDTH = 64;
export function draftSwipeOffset(raw: number) {
  const distance = Math.abs(raw);
  return (
    Math.sign(raw) *
    (distance <= DRAFT_ACTION_WIDTH
      ? distance
      : DRAFT_ACTION_WIDTH +
        12 * (1 - Math.exp(-(distance - DRAFT_ACTION_WIDTH) / 100)))
  );
}
export function draftSwipeRelease(offset: number, width: number) {
  const trigger = Math.max(108, Math.min(160, width * 0.42));
  return Math.abs(offset) >= trigger ? "execute" : "close";
}
export function SwipeDraft({
  children,
  onDelete,
  onGesture,
}: {
  children: ReactNode;
  onDelete: () => void;
  onGesture: () => void;
}) {
  const shell = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const latest = useRef({ onDelete, onGesture });
  latest.current = { onDelete, onGesture };
  const position = useRef(0),
    suppress = useRef(false);
  const reset = () => {
    position.current = 0;
    if (surface.current) {
      surface.current.style.transform = "translate3d(0,0,0)";
      shell.current?.style.setProperty("--swipe-progress", "0");
    }
  };
  useEffect(() => {
    const node = surface.current,
      root = shell.current;
    if (!node || !root) return;
    let pointer:
      | {
          id: number;
          x: number;
          y: number;
          left: number;
          locked: boolean;
          vertical: boolean;
          feedback: boolean;
        }
      | undefined;
    let frame = 0,
      nextOffset = 0,
      gestureOffset = 0,
      trigger = 140;
    const paint = () => {
      frame = 0;
      node.style.transform = `translate3d(${nextOffset}px,0,0)`;
      const side = "delete";
      if (root.dataset.side !== side) root.dataset.side = side;
      root.style.setProperty(
        "--swipe-progress",
        String(Math.min(1, Math.abs(nextOffset) / DRAFT_ACTION_WIDTH)),
      );
      root.toggleAttribute(
        "data-commit",
        Math.abs(gestureOffset) >= trigger,
      );
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      // A fresh tap ends suppression from the previous pan, including taps on
      // the menu itself. The menu still does not start a new swipe gesture.
      suppress.current = false;
      if ((event.target as Element).closest(".studio-draft-menu")) return;
      trigger = Math.max(108, Math.min(160, root.clientWidth * 0.42));
      gestureOffset = position.current;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: position.current,
        locked: false,
        vertical: false,
        feedback: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId || pointer.vertical)
        return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (!pointer.locked) {
        if (dx > 10) { pointer.vertical = true; latest.current.onGesture(); return; }
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 9) {
          pointer.vertical = true;
          latest.current.onGesture();
          return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        pointer.locked = true;
        latest.current.onGesture();
        suppress.current = true;
        node.setPointerCapture(event.pointerId);
        root.dataset.dragging = "true";
      }
      event.preventDefault();
      gestureOffset = Math.min(0, pointer.left + dx);
      nextOffset = draftSwipeOffset(gestureOffset);
      position.current = nextOffset;
      if (!frame) frame = requestAnimationFrame(paint);
      if (
        !pointer.feedback &&
        Math.abs(gestureOffset) >= trigger
      ) {
        pointer.feedback = true;
        selectionFeedback();
      }
    };
    const finish = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dragged = pointer.locked;
      pointer = undefined;
      cancelAnimationFrame(frame);
      frame = 0;
      if (node.hasPointerCapture(event.pointerId))
        node.releasePointerCapture(event.pointerId);
      delete root.dataset.dragging;
      root.removeAttribute("data-commit");
      if (!dragged) return;
      const result =
        event.type === "pointercancel"
          ? "close"
          : Math.abs(gestureOffset) >= trigger ? "execute" : "close";
      if (result === "execute") {
        reset();
        latest.current.onDelete();
      } else reset();
    };
    const click = (event: MouseEvent) => {
      if (suppress.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (position.current !== 0) {
        event.preventDefault();
        event.stopPropagation();
        reset();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move, { passive: false });
    node.addEventListener("pointerup", finish);
    node.addEventListener("pointercancel", finish);
    node.addEventListener("click", click, true);
    root.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", finish);
      node.removeEventListener("pointercancel", finish);
      node.removeEventListener("click", click, true);
      root.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div className="draft-swipe-shell" ref={shell}>
      <div className="draft-swipe-action draft-swipe-delete" aria-hidden="true">
        <Trash2 />
        <span>Delete</span>
      </div>
      <div className="draft-swipe-surface" ref={surface}>
        {children}
      </div>
    </div>
  );
}
