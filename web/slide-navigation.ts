/** Coalesce input per frame; network and previous animations never block a new move. */
export class SlideNavigator {
  private current: number;
  private target: number;
  private direction = 1;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private loading: AbortController | undefined;
  constructor(
    private options: {
      count: number;
      initial?: number;
      duration: number;
      prepare: (index: number, signal: AbortSignal) => Promise<unknown>;
      commit: (index: number, direction: number) => void;
      settled: () => void;
    },
  ) {
    this.current = this.target = options.initial || 0;
  }
  move(step: number) {
    if (this.disposed || this.options.count < 2) return;
    this.target =
      (((this.target + step) % this.options.count) + this.options.count) %
      this.options.count;
    this.direction = step < 0 ? -1 : 1;
    this.loading?.abort();
    this.loading = undefined;
    this.schedule();
  }
  /** A native swipe has already animated to this page. Commit without replaying it. */
  jump(step: number) {
    if (this.disposed || this.options.count < 2) return;
    clearTimeout(this.timer);
    clearTimeout(this.settleTimer);
    this.timer = undefined;
    this.loading?.abort();
    this.loading = undefined;
    this.current = this.target =
      (((this.current + step) % this.options.count) + this.options.count) %
      this.options.count;
    this.options.settled();
    this.options.commit(this.current, step < 0 ? -1 : 1);
  }
  private schedule() {
    if (this.disposed || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pump();
    }, 16);
  }
  private pump() {
    if (this.disposed || this.target === this.current) return;
    const target = this.target,
      direction = this.direction,
      controller = new AbortController();
    this.loading = controller;
    // The rendered image has its own loading/failure state. Preparation warms the
    // cache only; a slow decode must not hold the navigation controls hostage.
    void this.options.prepare(target, controller.signal).catch(() => {});
    this.current = target;
    this.options.commit(target, direction);
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined;
      if (this.disposed) return;
      this.options.settled();
    }, this.options.duration);
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.settleTimer);
    this.timer = undefined;
    this.loading?.abort();
    this.loading = undefined;
  }
}
