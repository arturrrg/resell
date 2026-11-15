export function profitChartPosition(
  clientX: number,
  left: number,
  width: number,
  count: number,
) {
  if (width <= 0 || count < 1) return null;
  const x = Math.max(20, Math.min(620, ((clientX - left) / width) * 640));
  const position = count === 1 ? 0 : ((x - 20) / 600) * (count - 1);
  return { x, position, index: Math.round(position) };
}
export function profitChartY(values: number[]) {
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = max - min || 1;
  return values.map((value) => 190 - ((value - min) / span) * 156);
}
