/** Distinguish a deliberate tap from the compatibility click after a pan. */
export class PointerIntent {
  private active: { id: number; x: number; y: number; moved: boolean } | null = null;
  private blockedUntil = 0;
  private awaitingTouchEnd = false;
  begin(id: number, x: number, y: number) {
    this.blockedUntil = 0;
    this.awaitingTouchEnd = false;
    this.active = { id, x, y, moved: false };
  }
  move(id: number, x: number, y: number) {
    const start = this.active;
    if (!start || start.id !== id || start.moved) return false;
    if (Math.hypot(x - start.x, y - start.y) <= 10) return false;
    start.moved = true;
    return true;
  }
  end(id: number, x: number, y: number, now: number) {
    this.move(id, x, y);
    if (this.active?.id !== id) return;
    if (this.active.moved) this.blockedUntil = now + 800;
    this.active = null;
  }
  cancel(id: number, now: number) {
    if (this.active?.id !== id) return false;
    this.blockedUntil = now + 800;
    this.awaitingTouchEnd = true;
    this.active = null;
    return true;
  }
  touchEnd(now: number) {
    if (this.awaitingTouchEnd || this.blockedUntil > now) this.blockedUntil = now + 800;
    this.awaitingTouchEnd = false;
  }
  suppress(detail: number, pointerType: string, touch: boolean, now: number) {
    // Keyboard and assistive activation have no pointer source.
    if (!detail && !pointerType && !touch) return false;
    return !!this.active?.moved || now < this.blockedUntil;
  }
}

export function installPointerIntentGuard(doc: Document) {
  const intent = new PointerIntent();
  const blurDraggedControl = () => {
    const focused = doc.activeElement;
    if (focused instanceof HTMLElement && focused.matches('button,a,summary,[role="button"]'))
      focused.blur();
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const input = event.pointerType === "mouse" ? "mouse" : "touch";
    if (doc.documentElement.dataset.pointerInput !== input)
      doc.documentElement.dataset.pointerInput = input;
    intent.begin(event.pointerId, event.clientX, event.clientY);
  };
  const move = (event: PointerEvent) => {
    if (intent.move(event.pointerId, event.clientX, event.clientY)) blurDraggedControl();
  };
  const up = (event: PointerEvent) =>
    intent.end(event.pointerId, event.clientX, event.clientY, performance.now());
  const cancel = (event: PointerEvent) => {
    if (intent.cancel(event.pointerId, performance.now())) blurDraggedControl();
  };
  const touchEnd = () => intent.touchEnd(performance.now());
  const activate = (event: MouseEvent) => {
    const pointerType = (event as PointerEvent).pointerType || "";
    const touch = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents: boolean } }).sourceCapabilities?.firesTouchEvents || false;
    if (intent.suppress(event.detail, pointerType, touch, performance.now())) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const key = (event: KeyboardEvent) => {
    if (doc.documentElement.dataset.pointerInput !== "keyboard" && ["Tab", "Enter", " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
      doc.documentElement.dataset.pointerInput = "keyboard";
  };
  doc.addEventListener("pointerdown", down, { capture: true, passive: true });
  doc.addEventListener("pointermove", move, { capture: true, passive: true });
  doc.addEventListener("pointerup", up, { capture: true, passive: true });
  doc.addEventListener("pointercancel", cancel, { capture: true, passive: true });
  doc.addEventListener("touchend", touchEnd, { capture: true, passive: true });
  doc.addEventListener("mousedown", activate, true);
  doc.addEventListener("click", activate, true);
  doc.addEventListener("keydown", key, true);
  return () => {
    doc.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", cancel, true);
    doc.removeEventListener("touchend", touchEnd, true);
    doc.removeEventListener("mousedown", activate, true);
    doc.removeEventListener("click", activate, true);
    doc.removeEventListener("keydown", key, true);
  };
}

export function restoreDialogFocus(before: HTMLElement | null) {
  if (!before?.isConnected) return;
  if (document.documentElement.dataset.pointerInput === "touch") {
    if (document.activeElement === before) before.blur();
  } else if (!before.closest('[inert],[hidden],[aria-hidden="true"]')) {
    before.focus({ preventScroll: true });
  }
}
