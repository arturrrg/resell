import { useEffect, useRef } from "react";
import { all, claimSourceRefresh, identity, type Device } from "./storage";
import { sourceIsDue, SOURCE_REQUEST_GAP } from "../shared/refresh";
export function nextRefresh(
  devices: Device[],
  now: number,
  visible: Set<string>,
  busy: Set<string>,
) {
  if (busy.has("$import")) return;
  return devices
    .filter(
      (d) =>
        d.saleStatus !== "sold" &&
        identity(d.listingUrl || "") &&
        !busy.has(d.id) &&
        sourceIsDue(d, now),
    )
    .sort(
      (a, b) =>
        Number(visible.has(b.id)) - Number(visible.has(a.id)) ||
        (Date.parse(a.sourceCheckedAt || "") || 0) -
          (Date.parse(b.sourceCheckedAt || "") || 0) ||
        a.id.localeCompare(b.id),
    )[0];
}
export function useAutoRefresh({
  enabled,
  workspace,
  busy,
  refresh,
  accept,
}: {
  enabled: boolean;
  workspace: string | null;
  busy: () => Set<string>;
  refresh: (device: Device, signal: AbortSignal) => Promise<unknown>;
  accept?: (device: Device) => boolean;
}) {
  const latest = useRef({ busy, refresh, accept });
  latest.current = { busy, refresh, accept };
  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      running = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined,
      lastStart = 0;
    function schedule(delay = SOURCE_REQUEST_GAP) {
      if (!stopped) {
        clearTimeout(timer);
        timer = setTimeout(() => void tick(), delay);
      }
    }
    async function tick() {
      if (stopped || running) return;
      if (
        document.visibilityState === "hidden" ||
        !navigator.onLine ||
        document.body.classList.contains('offer-editor-open') ||
        document.querySelector('.native-carousel[data-interacting="true"]') ||
        document.querySelector("dialog[open]")
      ) {
        schedule();
        return;
      }
      if (Date.now() - lastStart < SOURCE_REQUEST_GAP) {
        schedule(SOURCE_REQUEST_GAP - (Date.now() - lastStart));
        return;
      }
      running = true;
      try {
        const devices = await all();
        if (stopped) return;
        const visible = new Set(
          Array.from(document.querySelectorAll("article[id]"))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.bottom > 0 && r.top < window.innerHeight;
            })
            .map((el) => el.id),
        );
        const candidate = nextRefresh(
          latest.current.accept ? devices.filter(latest.current.accept) : devices,
          Date.now(),
          visible,
          latest.current.busy(),
        );
        if (candidate) {
          const claimed = await claimSourceRefresh(candidate.id, Date.now());
          if (!claimed || stopped) return;
          lastStart = Date.now();
          controller = new AbortController();
          await latest.current.refresh(claimed, controller.signal);
        }
      } catch {
        /* A later tick retries local storage/network failures. */
      } finally {
        running = false;
        controller = undefined;
        schedule();
      }
    }
    const wake = () => {
      if (document.visibilityState === "hidden") {
        controller?.abort();
        return;
      }
      if (!running)
        schedule(Math.max(0, SOURCE_REQUEST_GAP - (Date.now() - lastStart)));
    };
    schedule(2000);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled, workspace]);
}
