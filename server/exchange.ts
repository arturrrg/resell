import { load } from "cheerio";
import { freshRates, type ExchangeRates } from "../shared/exchange.js";
export function parseRates(html: string, now = new Date()): ExchangeRates {
  const $ = load(html);
  const table = $(".exchange__item")
    .filter((_, el) =>
      /Schimb valutar în numerar din sucursale/i.test($(el).find("h3").text()),
    )
    .first()
    .find("table");
  if (!table.length) throw Error("Bank cash selling table unavailable.");
  const date =
    $("input.curs__valutar_date[data-date]").first().attr("data-date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw Error("Bank rate date unavailable.");
  const sell = (code: string) => {
    const row = table
      .find("tbody tr")
      .filter(
        (_, el) => $(el).find('td[data-label="valuta"]').text().trim() === code,
      )
      .first();
    const value = Number(
      row.find('td[data-label="vânzare"]').text().trim().replace(",", "."),
    );
    if (!Number.isFinite(value) || value <= 0)
      throw Error("Invalid bank selling rate.");
    return value;
  };
  const rates: ExchangeRates = {
    date,
    publishedAt: `${date}T00:00:00.000Z`,
    fetchedAt: now.toISOString(),
    source: "maib",
    mdlPerEur: sell("EUR"),
    mdlPerUsd: sell("USD"),
  };
  if (!freshRates(rates, now.getTime()))
    throw Error("Bank rates are outdated.");
  return rates;
}
let cached: ExchangeRates | undefined,
  pending: Promise<ExchangeRates> | undefined;
export async function latestRates(): Promise<ExchangeRates> {
  const now = new Date();
  if (
    cached &&
    Date.now() - Date.parse(cached.fetchedAt) < 5 * 60000 &&
    freshRates(cached)
  )
    return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch("https://www.maib.md/ro/curs-valutar", {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw Error("Bank rate page unavailable.");
      if (Number(response.headers.get("content-length")) > 2000000)
        throw Error("Invalid rate response.");
      const reader = response.body?.getReader();
      if (!reader) throw Error("Empty rate response.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2000000) {
          await reader.cancel();
          throw Error("Invalid rate response.");
        }
        chunks.push(value);
      }
      cached = parseRates(Buffer.concat(chunks).toString("utf8"), now);
      return cached;
    } catch (error) {
      if (cached && freshRates(cached)) return { ...cached, stale: true };
      throw error;
    } finally {
      pending = undefined;
    }
  })();
  return pending;
}
