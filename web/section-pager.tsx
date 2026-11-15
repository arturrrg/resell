import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

export function sectionAt(left: number, width: number, count: number) {
  return width > 0
    ? Math.max(0, Math.min(count - 1, Math.round(left / width)))
    : 0;
}
export class SectionNavigation {
  private target: number | null = null;
  constructor(
    private page: number,
    private count: number,
  ) {}
  request(page: number) {
    this.page = page;
    this.target = page;
  }
  interrupt() {
    this.target = null;
  }
  observe(left: number, width: number) {
    if (!(width > 0) || !Number.isFinite(left)) return null;
    const next = sectionAt(left, width, this.count);
    if (this.target !== null && next !== this.target) return null;
    this.target = null;
    if (next === this.page) return null;
    this.page = next;
    return next;
  }
}

/** Retained vertical pages inside a compositor-driven horizontal snap track. */
export function SectionPager({
  index,
  count,
  active,
  disabled,
  onIndex,
  children,
}: {
  index: number;
  count: number;
  active: boolean;
  disabled: boolean;
  onIndex: (index: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    emitted = useRef<number | null>(null);
  const navigation = useRef(new SectionNavigation(index, count));
  const latest = useRef({ index, onIndex });
  latest.current = { index, onIndex };
  useLayoutEffect(() => {
    const track = ref.current;
    if (!track || !active) {
      emitted.current = null;
      return;
    }
    if (emitted.current === index) {
      emitted.current = null;
      return;
    }
    const left = index * track.getBoundingClientRect().width;
    navigation.current.request(index);
    if (Math.abs(track.scrollLeft - left) < 1) navigation.current.interrupt();
    track.scrollTo({
      left,
      // Section controls jump immediately, like the main workspace tabs.
      // Native finger movement skips this effect through the emitted guard.
      behavior: "instant",
    });
  }, [index, active, disabled]);
  useEffect(() => {
    const track = ref.current;
    if (!track || !active || disabled) return;
    let width = track.getBoundingClientRect().width;
    let pointer: {
      id: number;
      x: number;
      y: number;
      left: number;
      dragged: boolean;
    } | null = null;
    const scroll = () => {
      const next = navigation.current.observe(track.scrollLeft, width);
      if (next !== null) {
        emitted.current = next;
        latest.current.onIndex(next);
      }
    };
    const down = (event: PointerEvent) => {
      navigation.current.interrupt();
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        (event.target as Element).closest(
          "input,textarea,select,.native-carousel,.video-player,.studio-photo-grid",
        )
      )
        return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: track.scrollLeft,
        dragged: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (
        !pointer.dragged &&
        (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3)
      )
        return;
      if (!pointer.dragged) {
        pointer.dragged = true;
        track.classList.add("is-dragging");
        track.setPointerCapture(event.pointerId);
      }
      track.scrollLeft = pointer.left - dx;
      event.preventDefault();
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const before = pointer;
      pointer = null;
      if (track.hasPointerCapture(event.pointerId))
        track.releasePointerCapture(event.pointerId);
      track.classList.remove("is-dragging");
      if (before.dragged) {
        const dx = event.clientX - before.x;
        const page =
          event.type === "pointercancel"
            ? sectionAt(track.scrollLeft, width, count)
            : Math.abs(dx) > width * 0.18
              ? Math.round(before.left / width) + (dx < 0 ? 1 : -1)
              : sectionAt(before.left, width, count);
        track.scrollTo({
          left: Math.max(0, Math.min(count - 1, page)) * width,
          behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "instant"
            : "smooth",
        });
      }
    };
    const resize = new ResizeObserver(() => {
      const next = track.getBoundingClientRect().width;
      if (!next || next === width) return;
      width = next;
      track.scrollTo({
        left: latest.current.index * width,
        behavior: "instant",
      });
    });
    resize.observe(track);
    track.addEventListener("scroll", scroll, { passive: true });
    track.addEventListener("pointerdown", down, { passive: true });
    track.addEventListener("pointermove", move, { passive: false });
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
    return () => {
      resize.disconnect();
      track.classList.remove("is-dragging");
      if (pointer && track.hasPointerCapture(pointer.id))
        track.releasePointerCapture(pointer.id);
      track.removeEventListener("scroll", scroll);
      track.removeEventListener("pointerdown", down);
      track.removeEventListener("pointermove", move);
      track.removeEventListener("pointerup", up);
      track.removeEventListener("pointercancel", up);
    };
  }, [active, count, disabled]);
  return (
    <div
      ref={ref}
      className={`studio-tab-track${disabled ? " is-disabled" : ""}`}
    >
      {children}
    </div>
  );
}
