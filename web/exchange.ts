import { useEffect, useState } from "react";
import { type ExchangeRates, freshRates } from "../shared/exchange";
const KEY = "resell-exchange-rates-maib-v1";
function stored() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return freshRates(value) ? { ...value, stale: true } : null;
  } catch {
    return null;
  }
}
export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates | null>(stored);
  useEffect(() => {
    let stopped = false,
      pending = false,
      lastChecked = 0;
    const abort = new AbortController();
    async function update() {
      if (
        document.visibilityState === "hidden" ||
        pending ||
        Date.now() - lastChecked < 60000
      )
        return;
      pending = true;
      lastChecked = Date.now();
      try {
        const base = (import.meta as any).env.VITE_API_BASE_URL || "";
        if (base && !/^https:\/\//.test(base)) return;
        const response = await fetch(`${base}/api/exchange-rates`, {
          signal: abort.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.ok || !freshRates(data.rates))
          throw Error("Rates unavailable");
        if (!stopped) {
          setRates(data.rates);
          try {
            localStorage.setItem(KEY, JSON.stringify(data.rates));
          } catch {}
        }
      } catch {
        if (!stopped) setRates((old) => (old ? { ...old, stale: true } : null));
      } finally {
        pending = false;
      }
    }
    void update();
    const timer = setInterval(update, 5 * 60000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      stopped = true;
      abort.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return rates;
}
