type PublicationSource = {
  monitorActive?: boolean;
  monitoredAccount?: string;
  sourceAvailability?: unknown;
};

export function publicationIsVisible(source?: PublicationSource, hasReceipt = false) {
  if (source?.monitorActive === false) return false;
  if (source?.monitoredAccount || hasReceipt) return true;
  return String(source?.sourceAvailability || "").toLowerCase() !== "unavailable";
}

// Profile pages are cached for 60 seconds. Wait long enough to sample a new snapshot.
const PROFILE_ABSENCE_INTERVAL = 90_000;

export function profileAbsences(
  candidates: Iterable<string>,
  seen: ReadonlySet<string>,
  previous: [string, number][],
  checkedAt: number,
) {
  const firstMiss = new Map(previous);
  const pending: [string, number][] = [];
  const confirmed = new Set<string>();
  for (const id of candidates) {
    if (seen.has(id)) continue;
    const since = firstMiss.get(id) ?? checkedAt;
    if (checkedAt - since >= PROFILE_ABSENCE_INTERVAL) confirmed.add(id);
    else pending.push([id, since]);
  }
  return { pending, confirmed };
}
