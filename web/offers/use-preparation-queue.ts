import { useEffect, useRef, useState } from "react";
import type { OfferDraft } from "../../shared/offer-draft";
import { transferOffer } from "../../shared/offer-draft";
import { changeDraftState } from "./draft-store";
import { inNativeApp, preparationResult, prepareNativeOffer } from "./native";
import { preparationAccounts, preparationDraft } from "./preparation-prices";
import {
  applyPreparationResult,
  currentPreparation,
  newPreparationQueue,
  queueKey,
  readPreparationQueue,
  resumePreparation,
  waitingPreparation,
  type PreparationQueue,
} from "./preparation-queue";
export function usePreparationQueue(
  owner: string,
  draft: OfferDraft | null,
  onError: (message: string) => void,
  onRecorded?: (draft: OfferDraft) => void,
  onComplete?: (urls: string[], multiple: boolean) => void,
) {
  const [queue, setQueue] = useState<PreparationQueue | null>(() => {
    try {
      return readPreparationQueue(owner);
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const running = useRef(false),
    checked = useRef("");
  const latest = useRef({ draft, onError, onRecorded, onComplete });
  latest.current = { draft, onError, onRecorded, onComplete };
  const commit = (value: PreparationQueue) => {
    localStorage.setItem(queueKey(owner), JSON.stringify(value));
    setQueue(value);
  };
  async function launch(value: PreparationQueue, current: OfferDraft) {
    const waiting = waitingPreparation(value),
      entry = currentPreparation(waiting);
    if (!entry) return;
    commit(waiting);
    try {
      await prepareNativeOffer(
        await transferOffer(preparationDraft(current, entry)),
        owner,
        entry.id,
        entry.requestId,
        value.autoPublish === true,
      );
    } catch (error) {
      commit({ ...waiting, phase: "paused" });
      throw error;
    }
  }
  async function locked(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      latest.current.onError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const start = (accounts: { id: string; login: string }[]) =>
    locked(async () => {
      const current = latest.current.draft;
      if (!current) return;
      if (accounts.some(account => current.publications?.some(p => p.accountId === account.id)))
        throw Error("This offer was already submitted to a selected account. Check Inventory before creating another listing.");
      const existing = readPreparationQueue(owner);
      if (existing && existing.phase !== "completed") {
        setQueue(existing);
        throw Error("Resume or stop the unfinished preparation first.");
      }
      const value = newPreparationQueue(
        owner,
        current.id,
        current.title,
        preparationAccounts(current, accounts),
      );
      value.draftUpdatedAt = current.updatedAt;
      value.autoPublish = true;
      await launch(value, current);
    });
  useEffect(() => {
    if (
      !inNativeApp() ||
      !draft ||
      !queue ||
      queue.draftId !== draft.id ||
      queue.phase !== "waiting" ||
      running.current
    )
      return;
    const entry = currentPreparation(queue);
    if (!entry || checked.current === entry.requestId) return;
    checked.current = entry.requestId;
    void locked(async () => {
      let result;
      try {
        result = await preparationResult(owner, entry.requestId);
      } catch (error) {
        commit({ ...queue, phase: "paused" });
        throw error;
      }
      let next = applyPreparationResult(queue, result);
      if (next.phase === "ready" && draft.updatedAt !== queue.draftUpdatedAt)
        next = { ...next, phase: "paused" };
      let current = draft;
      const verified = next.entries.find(e => e.requestId === result?.requestId && e.result && ["published", "submitted"].includes(e.status));
      if (verified?.result?.advertId) {
        current = await changeDraftState(draft.id, owner, stored => ({ ...stored, publications: [...(stored.publications || []).filter(p => p.advertId !== verified.result!.advertId), { advertId: verified.result!.advertId!, accountId: verified.id, login: verified.login, price: verified.price ?? stored.price, currency: verified.currency ?? stored.currency, state: verified.status as "published" | "submitted" }] }));
        next = { ...next, draftUpdatedAt: current.updatedAt };
        latest.current.onRecorded?.(current);
      }
      commit(next);
      // Receipts come only from the native verifier, never from URL parameters
      // or a progress message. Unknown/cancelled returns always pause.
      if (next.phase === "ready") await launch(next, current);
      else if (next.phase === "completed") latest.current.onComplete?.(next.entries.flatMap(e => e.result?.url ? [e.result.url] : []), next.entries.length > 1);
      else if (next.phase === "paused")
        latest.current.onError(
          "Preparation paused. The last creation was not verified, or the draft changed. Review before continuing.",
        );
    });
  }, [
    draft?.id,
    queue?.phase,
    queue && currentPreparation(queue)?.requestId,
    owner,
  ]);
  const resume = () =>
    locked(async () => {
      const current = latest.current.draft;
      if (!current || !queue || queue.draftId !== current.id) return;
      const next = resumePreparation(queue);
      next.draftUpdatedAt = current.updatedAt;
      await launch(next, current);
    });
  const stop = () => {
    if (busy) return;
    try {
      if (queue) {
        // Keep completed receipts locally when cancelling the remaining work.
        localStorage.setItem(queueKey(owner) + ":last", JSON.stringify(queue));
      }
      localStorage.removeItem(queueKey(owner));
      setQueue(null);
      checked.current = "";
    } catch {
      latest.current.onError(
        "Could not save the queue change. Please try again.",
      );
    }
  };
  return { queue, busy, start, resume, stop };
}
