/** One retargetable arrow animation; presses accumulate intent, never animations. */
export class CarouselButtonMotion {
  running = false;
  private position = 1;
  private target = 1;
  private lastTime = 0;
  private deadline = 0;
  private count = 0;

  request(step: number, position: number, count: number, now: number) {
    if (
      count < 2 ||
      !Number.isFinite(position) ||
      !Number.isFinite(step) ||
      !step
    )
      return false;
    if (!this.running || count !== this.count) {
      this.position = position;
      this.target = Math.round(position);
    }
    this.target += step;
    this.count = count;
    this.lastTime = now;
    this.deadline = now + 160;
    this.running = true;
    return true;
  }

  advance(now: number, instant = false) {
    const remaining = Math.max(0, this.deadline - now);
    const before = Math.max(remaining, this.deadline - this.lastTime);
    // Cubic ease-out from the current position. Retargeting never restarts at
    // zero speed, and the last press always finishes within 160 ms.
    this.position =
      instant || !remaining || !before
        ? this.target
        : this.target +
          (this.position - this.target) * (remaining / before) ** 3;
    this.lastTime = now;
    this.running =
      !instant &&
      remaining > 0 &&
      Math.abs(this.target - this.position) > 0.001;
    if (!this.running) this.position = this.target;
    const page =
      ((((this.position - 1) % this.count) + this.count) % this.count) + 1;
    return {
      page,
      index:
        (((Math.round(this.target) - 1) % this.count) + this.count) %
        this.count,
      done: !this.running,
    };
  }

  cancel() {
    this.running = false;
  }
}
