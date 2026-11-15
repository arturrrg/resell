import { useLayoutEffect, useRef, type ReactNode } from "react";
import { settledSlide, releasedSlide } from "./swipe-motion";

/** Three recycled pages: touch tracking, momentum and snapping stay in the browser. */
export function SwipeSurface({
  children,
  previous,
  next,
  identity,
  enabled,
  onStep,
  className = "",
}: {
  children: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  identity: string;
  enabled: boolean;
  onStep: (step: number) => void;
  className?: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const callback = useRef(onStep);
  callback.current = onStep;
  useLayoutEffect(() => {
    const surface = node.current;
    if (!surface || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointer:
      { id: number; x: number; time: number; left: number } | undefined;
    let touching = false,
      moved = false,
      resetting = false,
      disposed = false;
    let frame = 0;
    const center = () => {
      resetting = true;
      surface.scrollTo({ left: surface.clientWidth, behavior: "instant" });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        resetting = false;
      });
    };
    const finish = () => {
      clearTimeout(timer);
      if (disposed || resetting || touching || pointer) return;
      const step = settledSlide(surface.scrollLeft, surface.clientWidth);
      if (step) callback.current(step);
      else center();
    };
    const queueFinish = () => {
      clearTimeout(timer);
      // scrollend handles modern WebViews; the short debounce is a fallback for
      // older browsers, not an extra pause after each native swipe.
      timer = setTimeout(finish, 80);
    };
    const scroll = () => {
      if (resetting) return;
      if (Math.abs(surface.scrollLeft - surface.clientWidth) > 5) moved = true;
      queueFinish();
    };
    const down = (event: PointerEvent) => {
      moved = false;
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        (event.target as Element).closest(".video-player")
      )
        return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        time: event.timeStamp,
        left: surface.scrollLeft,
      };
    };
    const drag = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const distance = event.clientX - pointer.x;
      if (Math.abs(distance) < 5 && !moved) return;
      moved = true;
      surface.setPointerCapture(event.pointerId);
      surface.classList.add("is-dragging");
      surface.scrollLeft = pointer.left - distance;
      event.preventDefault();
    };
    const up = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const start = pointer;
      pointer = undefined;
      surface.classList.remove("is-dragging");
      if (surface.hasPointerCapture(event.pointerId))
        surface.releasePointerCapture(event.pointerId);
      if (moved) {
        const step =
          event.type === "pointercancel"
            ? 0
            : releasedSlide(
                event.clientX - start.x,
                event.timeStamp - start.time,
                surface.clientWidth,
              );
        surface.scrollTo({
          left: surface.clientWidth * (1 + step),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
      queueFinish();
    };
    const touchStart = () => {
      touching = true;
      moved = false;
    };
    const touchEnd = (event: TouchEvent) => {
      touching = event.touches.length > 0;
      queueFinish();
    };
    const click = (event: MouseEvent) => {
      if (moved && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    center();
    const resize = new ResizeObserver(center);
    resize.observe(surface);
    surface.addEventListener("scroll", scroll, { passive: true });
    surface.addEventListener("scrollend", finish);
    surface.addEventListener("pointerdown", down);
    surface.addEventListener("pointermove", drag);
    surface.addEventListener("pointerup", up);
    surface.addEventListener("pointercancel", up);
    surface.addEventListener("touchstart", touchStart, { passive: true });
    surface.addEventListener("touchend", touchEnd, { passive: true });
    surface.addEventListener("touchcancel", touchEnd, { passive: true });
    surface.addEventListener("click", click, true);
    return () => {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      surface.classList.remove("is-dragging");
      if (pointer && surface.hasPointerCapture(pointer.id))
        surface.releasePointerCapture(pointer.id);
      resize.disconnect();
      surface.removeEventListener("scroll", scroll);
      surface.removeEventListener("scrollend", finish);
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointermove", drag);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", up);
      surface.removeEventListener("touchstart", touchStart);
      surface.removeEventListener("touchend", touchEnd);
      surface.removeEventListener("touchcancel", touchEnd);
      surface.removeEventListener("click", click, true);
    };
  }, [identity, enabled]);
  return (
    <div
      ref={node}
      className={`swipe-surface ${enabled ? "is-enabled" : ""} ${className}`}
    >
      {enabled && (
        <div className="swipe-page swipe-preview" aria-hidden="true">
          {previous}
        </div>
      )}
      <div className="swipe-page swipe-current">{children}</div>
      {enabled && (
        <div className="swipe-page swipe-preview" aria-hidden="true">
          {next}
        </div>
      )}
    </div>
  );
}
