import {
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from "react";
import { CarouselButtonMotion } from "./carousel-buttons";
import {
  carouselIndex,
  carouselTarget,
  carouselSwipe,
  carouselLoopOffset,
} from "./carousel-position";

/** Stable native pages: no DOM recycling or scroll reset between ordinary swipes. */
export type NativeCarouselHandle = { move: (step: number) => void };
export function NativeCarousel({
  ref,
  count,
  index,
  direction,
  active = true,
  onIndex,
  onVisibleIndex,
  renderPage,
  className = "",
}: {
  ref?: Ref<NativeCarouselHandle>;
  count: number;
  index: number;
  direction: number;
  active?: boolean;
  onIndex: (index: number) => void;
  onVisibleIndex?: (index: number) => void;
  renderPage: (index: number, clone: boolean) => ReactNode;
  className?: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const arrows = useRef<((step: number) => void) | null>(null);
  useImperativeHandle(
    ref,
    () => ({ move: (step) => arrows.current?.(step) }),
    [],
  );
  const latest = useRef({ count, index, onIndex, onVisibleIndex });
  latest.current = { count, index, onIndex, onVisibleIndex };
  const emitted = useRef<number | null>(null),
    previous = useRef(index);
  const pageWidth = (surface: HTMLDivElement) =>
    surface.getBoundingClientRect().width;
  const motion = useRef({
    user: false,
    touching: false,
    dragging: false,
    suppressClick: false,
    target: -1,
    initialized: false,
    count: 0,
  });
  useLayoutEffect(() => {
    const surface = node.current;
    if (!surface) {
      motion.current.initialized = false;
      return;
    }
    const state = motion.current;
    const width = pageWidth(surface);
    if (!width || !count) {
      state.initialized = false;
      return;
    }
    // Retained offscreen sections can become visible before their active flag
    // changes. Position their real photo before that first partial swipe.
    const positioned = active && state.initialized && state.count === count;
    if (positioned && emitted.current === index) {
      emitted.current = null;
      previous.current = index;
      return;
    }
    // A newly visible track starts on the real photo, never on a loop clone.
    const target = carouselTarget(
      index,
      previous.current,
      count,
      direction,
      positioned,
    );
    previous.current = index;
    state.user = false;
    state.target = target;
    surface.scrollTo({
      left: target * pageWidth(surface),
      behavior:
        positioned &&
        count > 1 &&
        Math.abs(target * pageWidth(surface) - surface.scrollLeft) <=
          pageWidth(surface) * 2 &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
    latest.current.onVisibleIndex?.(
      carouselIndex(surface.scrollLeft / pageWidth(surface), count),
    );
    state.initialized = active;
    state.count = count;
  }, [index, count, direction, active]);
  useLayoutEffect(() => {
    const surface = node.current;
    if (!surface || !active || count < 2) return;
    const state = motion.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointer:
      | { id: number; x: number; y: number; time: number; left: number }
      | undefined;
    let width = pageWidth(surface);
    const buttons = new CarouselButtonMotion();
    let buttonFrame = 0;
    const stopButtons = () => {
      cancelAnimationFrame(buttonFrame);
      buttonFrame = 0;
      buttons.cancel();
      surface.classList.remove("is-button-animating");
    };
    let visibleIndex = -1;
    const reportVisible = () => {
      if (!width) return;
      const next = carouselIndex(
        surface.scrollLeft / width,
        latest.current.count,
      );
      if (next !== visibleIndex) {
        visibleIndex = next;
        latest.current.onVisibleIndex?.(next);
      }
    };
    const report = () => {
      if (!state.user || !pageWidth(surface)) return;
      const next = carouselIndex(
        surface.scrollLeft / pageWidth(surface),
        latest.current.count,
      );
      if (next !== latest.current.index) {
        emitted.current = next;
        latest.current.onIndex(next);
      }
    };
    const finish = () => {
      clearTimeout(timer);
      if (buttons.running) return;
      if (state.touching || state.dragging || !pageWidth(surface)) return;
      const page = Math.round(surface.scrollLeft / pageWidth(surface));
      if (Math.abs(surface.scrollLeft - page * pageWidth(surface)) > 1) return;
      // An interrupted smooth scroll can emit scrollend before the new target.
      if (
        !state.user &&
        state.target >= 0 &&
        Math.abs(surface.scrollLeft - state.target * pageWidth(surface)) > 2
      )
        return;
      report();
      if (page === 0 || page === count + 1) {
        const next = carouselIndex(page, count);
        surface.scrollTo({
          left: (next + 1) * pageWidth(surface),
          behavior: "instant",
        });
        state.target = next + 1;
      }
      state.user = false;
      delete surface.dataset.interacting;
    };
    const scroll = () => {
      // Only the counter changes at the visible-page boundary; photo state settles later.
      reportVisible();
      clearTimeout(timer);
      if (!buttons.running) timer = setTimeout(finish, 100);
    };
    const animateButtons = (now: number, instant = false) => {
      buttonFrame = 0;
      const next = buttons.advance(now, instant);
      surface.scrollLeft = next.page * width;
      reportVisible();
      if (!next.done) {
        buttonFrame = requestAnimationFrame(animateButtons);
        return;
      }
      state.target = next.index + 1;
      surface.scrollLeft = state.target * width;
      surface.classList.remove("is-button-animating");
      reportVisible();
      emitted.current = next.index;
      latest.current.onIndex(next.index);
    };
    arrows.current = (step) => {
      if (!width) return;
      const now = performance.now();
      if (!buttons.running) {
        // Stop native momentum once; subsequent presses retarget this one
        // animation without queuing scrollTo(smooth) or rerendering photos.
        surface.scrollTo({ left: surface.scrollLeft, behavior: "instant" });
        surface.classList.add("is-button-animating");
      }
      state.user = false;
      state.target = -1;
      clearTimeout(timer);
      delete surface.dataset.interacting;
      if (!buttons.request(step, surface.scrollLeft / width, count, now))
        return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cancelAnimationFrame(buttonFrame);
        animateButtons(now, true);
      } else if (!buttonFrame) {
        buttonFrame = requestAnimationFrame(animateButtons);
      }
    };
    const down = (event: PointerEvent) => {
      if (
        (event.target as Element).closest(".video-player") ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      stopButtons();
      state.suppressClick = false;
      surface.dataset.interacting = "true";
      state.user = true;
      state.target = -1;
      state.touching = event.pointerType !== "mouse";
      const wrapped = carouselLoopOffset(
        surface.scrollLeft,
        pageWidth(surface),
        count,
      );
      if (wrapped !== surface.scrollLeft)
        surface.scrollTo({ left: wrapped, behavior: "instant" });
      // Stop existing momentum at the finger, instead of waiting for it.
      if (event.pointerType !== "mouse") {
        state.touching = true;
        return;
      }
      surface.scrollTo({ left: surface.scrollLeft, behavior: "instant" });
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        left: surface.scrollLeft,
      };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const distance = event.clientX - pointer.x;
      if (
        !state.dragging &&
        (Math.abs(distance) < 5 ||
          Math.abs(distance) < Math.abs(event.clientY - pointer.y))
      )
        return;
      state.dragging = true;
      state.suppressClick = true;
      surface.classList.add("is-dragging");
      surface.setPointerCapture(event.pointerId);
      surface.scrollLeft = pointer.left - distance;
      event.preventDefault();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType === "mouse") state.touching = false;
      if (pointer?.id === event.pointerId) {
        const start = pointer;
        pointer = undefined;
        const dragged = state.dragging;
        state.dragging = false;
        surface.classList.remove("is-dragging");
        if (surface.hasPointerCapture(event.pointerId))
          surface.releasePointerCapture(event.pointerId);
        if (dragged) {
          const step =
            event.type === "pointercancel"
              ? 0
              : carouselSwipe(
                  event.clientX - start.x,
                  event.timeStamp - start.time,
                  pageWidth(surface),
                );
          const page = Math.max(
            0,
            Math.min(
              count + 1,
              Math.round(start.left / pageWidth(surface)) + step,
            ),
          );
          surface.scrollTo({
            left: page * pageWidth(surface),
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
        }
      }
      clearTimeout(timer);
      timer = setTimeout(finish, 100);
    };
    const touchEnd = () => {
      state.touching = false;
      clearTimeout(timer);
      timer = setTimeout(finish, 100);
    };
    const click = (event: MouseEvent) => {
      if (
        (state.suppressClick ||
          (state.user &&
            Math.abs(
              surface.scrollLeft / pageWidth(surface) -
                Math.round(surface.scrollLeft / pageWidth(surface)),
            ) > 0.02)) &&
        event.detail !== 0
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const touchMove = () => {
      state.suppressClick = true;
    };
    const resize = new ResizeObserver(() => {
      if (!pageWidth(surface) || pageWidth(surface) === width) return;
      width = pageWidth(surface);
      stopButtons();
      state.user = false;
      state.target = latest.current.index + 1;
      surface.scrollTo({ left: state.target * width, behavior: "instant" });
    });
    resize.observe(surface);
    reportVisible();
    // Some Android WebViews expose scrollend but miss it after interrupted gestures.
    // This timer only settles the position; it never renders during finger movement.
    surface.addEventListener("scroll", scroll, { passive: true });
    surface.addEventListener("scrollend", finish);
    surface.addEventListener("pointerdown", down);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", up);
    surface.addEventListener("pointercancel", up);
    surface.addEventListener("touchend", touchEnd, { passive: true });
    surface.addEventListener("touchcancel", touchEnd, { passive: true });
    surface.addEventListener("touchmove", touchMove, { passive: true });
    surface.addEventListener("click", click, true);
    return () => {
      clearTimeout(timer);
      stopButtons();
      arrows.current = null;
      resize.disconnect();
      delete surface.dataset.interacting;
      surface.removeEventListener("scroll", scroll);
      surface.removeEventListener("scrollend", finish);
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", up);
      surface.removeEventListener("touchend", touchEnd);
      surface.removeEventListener("touchcancel", touchEnd);
      surface.removeEventListener("touchmove", touchMove);
      surface.removeEventListener("click", click, true);
    };
  }, [count, active]);
  const pages =
    count > 1
      ? [count - 1, ...Array.from({ length: count }, (_, i) => i), 0]
      : [0];
  return (
    <div
      ref={node}
      className={`swipe-surface native-carousel ${count > 1 ? "is-enabled" : ""} ${className}`}
    >
      {pages.map((at, slot) => (
        <div
          className="swipe-page"
          key={slot}
          aria-hidden={
            at !== index || (count > 1 && (slot === 0 || slot === count + 1))
          }
        >
          {renderPage(at, count > 1 && (slot === 0 || slot === count + 1))}
        </div>
      ))}
    </div>
  );
}
