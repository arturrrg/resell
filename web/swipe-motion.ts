export function settledSlide(left: number, width: number): number {
  return width > 0
    ? Math.max(-1, Math.min(1, Math.round(left / width) - 1))
    : 0;
}

/** Mouse fallback only; native touch scrolling supplies its own momentum. */
export function releasedSlide(
  distance: number,
  elapsed: number,
  width: number,
): number {
  if (width <= 0 || Math.abs(distance) < 8) return 0;
  const velocity = Math.abs(distance) / Math.max(elapsed, 1);
  return Math.abs(distance) > width * 0.22 ||
    (Math.abs(distance) > 24 && velocity > 0.4)
    ? distance < 0
      ? 1
      : -1
    : 0;
}
