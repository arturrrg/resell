import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
export const workspacePages = ["inventory", "offers", "sales"] as const;
export type WorkspacePage = (typeof workspacePages)[number];
export const workspaceIndex = (page: WorkspacePage) =>
  workspacePages.indexOf(page);
export function workspacePageAt(left: number, width: number): WorkspacePage {
  return width > 0
    ? workspacePages[Math.max(0, Math.min(2, Math.round(left / width)))]
    : "inventory";
}
/** Publish visible-page changes without waiting for native momentum to finish. */
export class WorkspaceNavigation {
  private target: WorkspacePage | null = null;
  constructor(private page: WorkspacePage) {}
  request(page: WorkspacePage) {
    this.page = page;
    this.target = page;
  }
  interrupt() {
    this.target = null;
  }
  observe(left: number, width: number): WorkspacePage | null {
    if (!(width > 0) || !Number.isFinite(left)) return null;
    const next = workspacePageAt(left, width);
    // A tab-button animation passes through the old page on its way to the
    // requested one. Those intermediate positions must not undo the button tap.
    if (this.target && next !== this.target) return null;
    this.target = null;
    if (next === this.page) return null;
    this.page = next;
    return next;
  }
}
export function useMobileWorkspace() {
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width:760px)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(max-width:760px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
/** Native scrolling moves the pages; navigation follows the dominant visible page. */
export function WorkspacePager({
  page,
  mobile,
  onPage,
  children,
}: {
  page: WorkspacePage;
  mobile: boolean;
  onPage: (page: WorkspacePage) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    emitted = useRef<WorkspacePage | null>(null),
    navigation = useRef(new WorkspaceNavigation(page));
  const latest = useRef({ page, onPage });
  latest.current = { page, onPage };
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !mobile) return;
    if (emitted.current === page) {
      emitted.current = null;
      return;
    }
    const left = workspaceIndex(page) * node.getBoundingClientRect().width;
    navigation.current.request(page);
    if (Math.abs(node.scrollLeft - left) < 1) navigation.current.interrupt();
    node.scrollTo({
      left,
      // Tab taps jump directly. Native finger pans are handled by the browser
      // and skip this effect through the emitted-page check above.
      behavior: "instant",
    });
  }, [page, mobile]);
  useEffect(() => {
    const node = ref.current;
    if (!node || !mobile) return;
    let pointer: {
      id: number;
      x: number;
      y: number;
      left: number;
      dragged: boolean;
    } | null = null;
    let suppressUntil = 0,
      width = node.getBoundingClientRect().width;
    const scroll = () => {
      const next = navigation.current.observe(node.scrollLeft, width);
      if (next) {
        emitted.current = next;
        latest.current.onPage(next);
      }
    };
    const down = (event: PointerEvent) => {
      suppressUntil = 0;
      navigation.current.interrupt();
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        (event.target as Element).closest(
          '.native-carousel,.draft-swipe-shell,.studio-editor-screen,[role="slider"]',
        )
      )
        return;
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: node.scrollLeft,
        dragged: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (
        !pointer.dragged &&
        (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.3)
      )
        return;
      if (!pointer.dragged) {
        pointer.dragged = true;
        node.classList.add("is-dragging");
        node.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      node.scrollLeft = pointer.left - dx;
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const before = pointer;
      pointer = null;
      if (node.hasPointerCapture(event.pointerId))
        node.releasePointerCapture(event.pointerId);
      node.classList.remove("is-dragging");
      if (before.dragged) {
        suppressUntil = performance.now() + 500;
        const distance = event.clientX - before.x;
        const beforePage = Math.round(before.left / width);
        const target =
          Math.abs(distance) > width * 0.18
            ? beforePage + (distance < 0 ? 1 : -1)
            : beforePage;
        const next = Math.max(0, Math.min(2, target)) * width;
        node.scrollTo({ left: next, behavior: "smooth" });
      }
      scroll();
    };
    const click = (event: MouseEvent) => {
      if (event.detail && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const resize = new ResizeObserver(() => {
      const next = node.getBoundingClientRect().width;
      if (!next || next === width) return;
      width = next;
      node.scrollTo({
        left: workspaceIndex(latest.current.page) * width,
        behavior: "instant",
      });
    });
    resize.observe(node);
    node.addEventListener("scroll", scroll, { passive: true });
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move, { passive: false });
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("click", click, true);
    return () => {
      resize.disconnect();
      node.removeEventListener("scroll", scroll);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("click", click, true);
    };
  }, [mobile]);
  return (
    <div ref={ref} className="workspace-pager">
      {children}
    </div>
  );
}
