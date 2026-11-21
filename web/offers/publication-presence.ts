import { LISTING_UNAVAILABLE } from "../../shared/refresh";

type PublicationSource = {
  monitorActive?: boolean;
  sourceAvailability?: unknown;
};

export function publicationIsVisible(source?: PublicationSource) {
  return (
    source?.monitorActive !== false &&
    String(source?.sourceAvailability || "").toLowerCase() !== "unavailable"
  );
}

export async function confirmedUnavailableAdverts(
  candidates: Iterable<string>,
  base: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  // Bound the extra requests while a profile is changing. Repeated profile
  // absences still cover listings beyond this batch.
  const ids = Array.from(candidates).slice(0, 3);
  const checks = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetcher(base + "/api/import-999", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://999.md/ro/" + id, refresh: true }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        });
        if (response.status === 404) {
          if ((await response.json()).code === LISTING_UNAVAILABLE) return id;
        } else {
          await response.body?.cancel();
        }
      } catch {
        // A failed check is inconclusive. The profile monitor can retry.
      }
    }),
  );
  signal.throwIfAborted();
  return new Set(checks.filter((id): id is string => id !== undefined));
}

// Profile pages are cached for 60 seconds. Wait long enough to sample a new snapshot.
const PROFILE_ABSENCE_INTERVAL = 90_000;

export function profileAbsences(
  candidates: Iterable<string>,
  seen: ReadonlySet<string>,
  previous: [string, number][],
  checkedAt: number,
  unavailable?: ReadonlySet<string>,
) {
  const firstMiss = new Map(previous);
  const pending: [string, number][] = [];
  const confirmed = new Set<string>();
  for (const id of candidates) {
    if (seen.has(id)) continue;
    const since = firstMiss.get(id) ?? checkedAt;
    if (unavailable?.has(id) || checkedAt - since >= PROFILE_ABSENCE_INTERVAL)
      confirmed.add(id);
    else pending.push([id, since]);
  }
  return { pending, confirmed };
}
