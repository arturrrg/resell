export function carouselIndex(page: number, count: number) {
  return count > 0 ? (((Math.round(page) - 1) % count) + count) % count : 0;
}
/** At an identical edge clone, move to the real page before the next gesture. */
export function carouselLoopOffset(left: number, width: number, count: number) {
  if (width <= 0 || count < 2) return left;
  if (Math.abs(left) <= 1) return count * width;
  if (Math.abs(left - (count + 1) * width) <= 1) return width;
  return left;
}
export function carouselTarget(
  index: number,
  previous: number,
  count: number,
  direction: number,
  initialized = true,
) {
  if (count < 2) return 0;
  if (!initialized) return index + 1;
  if (previous === count - 1 && index === 0 && direction > 0) return count + 1;
  if (previous === 0 && index === count - 1 && direction < 0) return 0;
  return index + 1;
}
export function carouselSwipe(
  distance: number,
  elapsed: number,
  width: number,
) {
  return width > 0 &&
    Math.abs(distance) >= 24 &&
    (Math.abs(distance) > width * 0.22 ||
      Math.abs(distance) / Math.max(1, elapsed) > 0.4)
    ? distance < 0
      ? 1
      : -1
    : 0;
}
