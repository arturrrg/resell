import { useLayoutEffect, useRef } from "react";

/** Registered only while a surface is open. Nothing runs on scroll or frames. */
export class BackActions {
  private lastSystemBack = -Infinity;
  private serial = 0;
  private entries = new Map<number, { action: () => void; priority: number }>();
  add(action: () => void, priority = 100) {
    const id = ++this.serial;
    this.entries.set(id, { action, priority });
    return () => {
      this.entries.delete(id);
    };
  }
  handle() {
    let chosen: { action: () => void; priority: number } | undefined;
    for (const entry of this.entries.values())
      if (!chosen || entry.priority >= chosen.priority) chosen = entry;
    if (!chosen) return false;
    chosen.action();
    return true;
  }
  handleSystem(now = performance.now()) {
    // Android's Back callback and a native dialog cancel can describe the same
    // gesture. Consume its duplicate without delaying the first action.
    if (now - this.lastSystemBack < 80) return true;
    const handled = this.handle();
    if (handled) this.lastSystemBack = now;
    return handled;
  }
}
export const backActions = new BackActions();
export function useBackAction(
  enabled: boolean,
  action: () => void,
  priority = 100,
) {
  const latest = useRef(action);
  latest.current = action;
  useLayoutEffect(() => {
    if (enabled) return backActions.add(() => latest.current(), priority);
  }, [enabled, priority]);
}
export function installBackNavigation(target: Window) {
  const back = (event: Event) => {
    try {
      if (backActions.handleSystem()) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  };
  target.addEventListener("resell:back", back);
  return () => target.removeEventListener("resell:back", back);
}
