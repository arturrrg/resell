export function filterMenuPosition(
  anchor: { left: number; top: number; bottom: number; width: number },
  viewport: { width: number; height: number },
  count: number,
) {
  const margin = 10,
    gap = 6;
  const width = Math.max(
    0,
    Math.min(Math.max(anchor.width, 176), viewport.width - margin * 2),
  );
  const desired = Math.min(230, count * 42 + 12);
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - gap - margin);
  const upwards = below < desired && above > below;
  const maxHeight = Math.max(
    0,
    Math.min(230, upwards ? above : below, viewport.height - margin * 2),
  );
  const height = Math.min(desired, maxHeight);
  const top = upwards ? anchor.top - gap - height : anchor.bottom + gap;
  return {
    left: Math.max(
      margin,
      Math.min(anchor.left, viewport.width - width - margin),
    ),
    top: Math.max(margin, Math.min(top, viewport.height - height - margin)),
    width,
    maxHeight,
  };
}
