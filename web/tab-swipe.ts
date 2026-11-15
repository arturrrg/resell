import { useCallback, useEffect, useRef, useState } from "react";
export function tabSwipe(dx: number, dy: number, elapsed: number) {
  return Math.abs(dx) >= 64 &&
    Math.abs(dx) > Math.abs(dy) * 1.6 &&
    elapsed < 700
    ? dx < 0
      ? 1
      : -1
    : 0;
}
/** Pointer events plus declared pan-y leave vertical scrolling off the blocking touch path. */
export function useTabSwipe(onStep: (step: number) => void) {
  const latest = useRef(onStep);
  latest.current = onStep;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (element: HTMLElement | null) => setNode(element),
    [],
  );
  useEffect(() => {
    if (!node) return;
    node.dataset.tabSwipeScope = "true";
    let start: {
      id: number;
      x: number;
      y: number;
      time: number;
      target: Element;
      locked: boolean;
    } | null = null;
    let suppressUntil = 0;
    const owned = (target: Element) =>
      target.closest(
        '.native-carousel,.video-player,.draft-swipe-shell,[role="slider"],input[type="range"],.studio-photo-grid.is-reordering',
      );
    const down = (event: PointerEvent) => {
      suppressUntil = 0;
      const target = event.target as Element;
      if (
        innerWidth > 760 ||
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        target.closest("[data-tab-swipe-scope]") !== node ||
        owned(target)
      ) {
        start = null;
        return;
      }
      start = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        target,
        locked: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!start || start.id !== event.pointerId) return;
      if (owned(start.target)) {
        start = null;
        return;
      }
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      if (!start.locked && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        start = null;
        return;
      }
      if (
        !start.locked &&
        Math.abs(dx) > 12 &&
        Math.abs(dx) > Math.abs(dy) * 1.6
      ) {
        start.locked = true;
        node.setPointerCapture(event.pointerId);
      }
    };
    const release = (event: PointerEvent) => {
      if (!start || start.id !== event.pointerId) return;
      const before = start;
      start = null;
      if (node.hasPointerCapture(event.pointerId))
        node.releasePointerCapture(event.pointerId);
      if (event.type === "pointercancel" || owned(before.target)) return;
      const step = tabSwipe(
        event.clientX - before.x,
        event.clientY - before.y,
        event.timeStamp - before.time,
      );
      if (step) {
        suppressUntil = performance.now() + 500;
        (document.activeElement as HTMLElement | null)?.blur();
        latest.current(step);
      }
    };
    const click = (event: MouseEvent) => {
      if (event.detail && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node.addEventListener("pointerdown", down, {
      passive: true,
      capture: true,
    });
    node.addEventListener("pointermove", move, {
      passive: true,
      capture: true,
    });
    node.addEventListener("pointerup", release, {
      passive: true,
      capture: true,
    });
    node.addEventListener("pointercancel", release, {
      passive: true,
      capture: true,
    });
    node.addEventListener("click", click, true);
    return () => {
      delete node.dataset.tabSwipeScope;
      node.removeEventListener("pointerdown", down, true);
      node.removeEventListener("pointermove", move, true);
      node.removeEventListener("pointerup", release, true);
      node.removeEventListener("pointercancel", release, true);
      node.removeEventListener("click", click, true);
    };
  }, [node]);
  return ref;
}
