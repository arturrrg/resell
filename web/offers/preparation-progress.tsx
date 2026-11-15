import { Check, ArrowRight, Pause, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { visibleCountdown } from "./visible-countdown";
import type { PreparationQueue } from "./preparation-queue";
import { marketplaceNickname } from "./marketplace-identity";
export function PreparationProgress({
  queue,
  busy,
  onResume,
  onStop,
  onOpen,
  visible = true,
}: {
  queue: PreparationQueue;
  busy: boolean;
  onResume: () => void;
  onStop: () => void;
  onOpen?: () => void;
  visible?: boolean;
}) {
  const live = useRef({ visible, onStop }); live.current = { visible, onStop };
  const countdown = useRef<ReturnType<typeof visibleCountdown> | undefined>(undefined);
  useEffect(() => {
    if (queue.phase !== "completed") return;
    const timer = visibleCountdown(10000, () => live.current.visible && document.visibilityState === "visible", () => live.current.onStop());
    countdown.current = timer;
    document.addEventListener("visibilitychange", timer.refresh);
    return () => { timer.stop(); countdown.current = undefined; document.removeEventListener("visibilitychange", timer.refresh); };
  }, [queue.phase, queue.createdAt]);
  useEffect(() => { countdown.current?.refresh(); }, [visible]);
  const done = queue.entries.filter((e) =>
    ["published", "submitted"].includes(e.status),
  ).length;
  return (
    <section
      className="preparation-progress"
      aria-label="Offer preparation queue"
    >
      <div className="preparation-progress-heading">
        <span className="preparation-progress-symbol">
          {queue.phase === "completed" ? <Check /> : <Pause />}
        </span>
        <div>
          <strong>
            {queue.phase === "completed"
              ? "Creation complete"
              : queue.phase === "paused"
                ? "Preparation paused"
                : "Preparing accounts"}
          </strong>
          <span>
            {done} of {queue.entries.length} verified · {queue.title}
          </span>
        </div>
        <button
          aria-label="Stop preparation queue"
          onClick={onStop}
          disabled={busy}
        >
          <X />
        </button>
      </div>
      <div className="preparation-account-statuses">
        {queue.entries.map((entry) => (
          <div key={entry.id}>
            <span>{marketplaceNickname(entry.login)}</span>
            <small>
              {entry.status === "published"
                ? "Published"
                : entry.status === "submitted"
                  ? "Awaiting moderation"
                  : entry.status === "waiting"
                    ? queue.phase === "paused"
                      ? "Needs review"
                      : queue.autoPublish ? "Publishing on 999.md" : "Awaiting your Publish"
                    : "Pending"}
            </small>
          </div>
        ))}
      </div>
      {queue.phase !== "completed" && (onOpen || queue.phase !== "waiting") && (
        <button
          className="preparation-resume"
          disabled={busy}
          onClick={onOpen || onResume}
        >
          {onOpen ? "Open queued offer" : "Review & resume remaining"}
          <ArrowRight />
        </button>
      )}
      {queue.phase === "completed" &&
        queue.entries.some((e) => e.status === "submitted") && (
          <p>Creation was accepted. Moderation is still pending.</p>
        )}
    </section>
  );
}
