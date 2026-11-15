export type QueueResult = {
  requestId: string;
  owner: string;
  draftId: string;
  accountId: string;
  status: "published" | "submitted" | "cancelled";
  advertId?: string;
  state?: string;
  url?: string;
};
export type QueueEntry = {
  price?: string;
  currency?: "MDL" | "EUR" | "USD";
  id: string;
  login: string;
  requestId: string;
  status: "pending" | "waiting" | "published" | "submitted";
  result?: QueueResult;
};
export type PreparationQueue = {
  version: 1;
  owner: string;
  draftId: string;
  title: string;
  createdAt: string;
  draftUpdatedAt: string;
  autoPublish?: boolean;
  phase: "ready" | "waiting" | "paused" | "completed";
  entries: QueueEntry[];
};
export function newPreparationQueue(
  owner: string,
  draftId: string,
  title: string,
  accounts: { id: string; login: string; price?: string; currency?: "MDL" | "EUR" | "USD" }[],
): PreparationQueue {
  if (
    !accounts.length ||
    accounts.length > 20 ||
    new Set(accounts.map((a) => a.id)).size !== accounts.length
  )
    throw Error("Choose between one and twenty different accounts.");
  if (accounts.some(a => (a.price !== undefined && (!/^\d+(?:[.,]\d{1,2})?$/.test(a.price) || Number(a.price.replace(",", ".")) <= 0)) || (a.currency !== undefined && !["MDL", "EUR", "USD"].includes(a.currency)))) throw Error("Enter a valid price for each selected account.");
  return {
    version: 1,
    owner,
    draftId,
    title,
    draftUpdatedAt: "",
    createdAt: new Date().toISOString(),
    phase: "ready",
    entries: accounts.map((a) => ({
      ...a,
      requestId: crypto.randomUUID(),
      status: "pending",
    })),
  };
}
export const currentPreparation = (queue: PreparationQueue) =>
  queue.entries.find((e) => e.status === "waiting" || e.status === "pending");
export function waitingPreparation(queue: PreparationQueue): PreparationQueue {
  const current = currentPreparation(queue);
  if (!current) return { ...queue, phase: "completed" };
  return {
    ...queue,
    phase: "waiting",
    entries: queue.entries.map((e) =>
      e === current ? { ...e, status: "waiting" } : e,
    ),
  };
}
export function applyPreparationResult(
  queue: PreparationQueue,
  result: QueueResult | null,
): PreparationQueue {
  if (
    result &&
    queue.entries.some(
      (e) =>
        e.requestId === result.requestId &&
        ["published", "submitted"].includes(e.status),
    )
  )
    return queue;
  const entry = currentPreparation(queue);
  if (!entry) return { ...queue, phase: "completed" };
  if (
    !result ||
    result.requestId !== entry.requestId ||
    result.owner !== queue.owner ||
    result.draftId !== queue.draftId ||
    result.accountId !== entry.id ||
    !["published", "submitted"].includes(result.status) ||
    !/^[1-9]\d{5,11}$/.test(result.advertId || "") ||
    !["AD_STATE_PUBLIC", "AD_STATE_PRE_MODERATION"].includes(
      result.state || "",
    ) ||
    (result.status === "published") !== (result.state === "AD_STATE_PUBLIC") ||
    (result.url !== "https://999.md/ro/" + result.advertId &&
      result.url !== "https://999.md/ru/" + result.advertId)
  )
    return { ...queue, phase: "paused" };
  const entries = queue.entries.map((e) =>
    e === entry
      ? { ...e, status: result.status as "published" | "submitted", result }
      : e,
  );
  return {
    ...queue,
    entries,
    phase: entries.some((e) => e.status === "pending") ? "ready" : "completed",
  };
}
export function resumePreparation(queue: PreparationQueue): PreparationQueue {
  const entry = currentPreparation(queue);
  return {
    ...queue,
    phase: "ready",
    entries: queue.entries.map((e) =>
      e === entry
        ? { ...e, status: "pending", requestId: crypto.randomUUID() }
        : e,
    ),
  };
}
export const queueKey = (owner: string) =>
  "resell-preparation-queue-v1:" + owner;
export function readPreparationQueue(
  owner: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): PreparationQueue | null {
  const raw = storage.getItem(queueKey(owner));
  if (!raw) return null;
  const q = JSON.parse(raw);
  if (
    q.version !== 1 ||
    q.owner !== owner ||
    typeof q.draftId !== "string" ||
    typeof q.title !== "string" ||
    !["ready", "waiting", "paused", "completed"].includes(q.phase) ||
    !Array.isArray(q.entries) ||
    !q.entries.length ||
    q.entries.length > 20 ||
    q.entries.some(
      (e: any) =>
        typeof e.id !== "string" ||
        typeof e.login !== "string" ||
        typeof e.requestId !== "string" ||
        (e.price !== undefined && (typeof e.price !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(e.price) || Number(e.price.replace(",", ".")) <= 0)) ||
        (e.currency !== undefined && !["MDL", "EUR", "USD"].includes(e.currency)) ||
        !["pending", "waiting", "published", "submitted"].includes(e.status),
    ) ||
    new Set(q.entries.map((e: any) => e.id)).size !== q.entries.length
  )
    throw Error("Saved preparation could not be read.");
  return q;
}
