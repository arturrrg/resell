/** Counts time only while the notice is visible to its user. */
export function visibleCountdown(milliseconds: number, visible: () => boolean, done: () => void, clock = {
  now: () => performance.now(),
  set: (run: () => void, delay: number) => setTimeout(run, delay),
  clear: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
}) {
  let remaining = milliseconds, started: number | undefined, timer: ReturnType<typeof setTimeout> | undefined, stopped = false;
  const pause = () => {
    if (started !== undefined) remaining = Math.max(0, remaining - (clock.now() - started));
    started = undefined;
    if (timer !== undefined) clock.clear(timer);
    timer = undefined;
  };
  const refresh = () => {
    if (stopped) return;
    pause();
    if (!visible()) return;
    started = clock.now();
    timer = clock.set(() => { stopped = true; done(); }, remaining);
  };
  refresh();
  return { refresh, stop: () => { pause(); stopped = true; } };
}
