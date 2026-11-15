/** Keep receipts, but hide inventory entries confirmed absent from the public marketplace. */
export function publicationIsVisible(source?: { monitorActive?: boolean; sourceAvailability?: unknown }) {
  return source?.monitorActive !== false && !(typeof source?.sourceAvailability === "string" && source.sourceAvailability.toLowerCase() === "unavailable");
}
