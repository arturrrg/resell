import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchProfileOffers, profileLogin } from "../server/profile-offers.js";
const cache = new Map<string, { expires: number; value: Awaited<ReturnType<typeof fetchProfileOffers>> }>();
const pending = new Map<string, Promise<Awaited<ReturnType<typeof fetchProfileOffers>>>>();
const limits = new Map<string, { count: number; until: number }>();
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  if (origin && allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin"); res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST." });
  try {
    const login = profileLogin(req.body?.login), skip = req.body?.skip ?? 0;
    if (!Number.isInteger(skip) || skip < 0 || skip > 20000 || skip % 50) throw Error("Invalid page.");
    const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0];
    if (limits.size >= 1000) for (const [id, entry] of limits) if (entry.until <= Date.now()) limits.delete(id);
    const limit = limits.get(ip);
    if (limit && limit.until > Date.now() && limit.count >= 60) return res.status(429).json({ ok: false, error: "Please wait a minute before updating more offers." });
    if (limits.size >= 1000 && !limit) return res.status(429).json({ ok: false, error: "Updates are busy. Please retry shortly." });
    limits.set(ip, limit && limit.until > Date.now() ? { ...limit, count: limit.count + 1 } : { until: Date.now() + 60000, count: 1 });
    const key = login.toLowerCase() + ":" + skip, cached = cache.get(key);
    if (req.body?.fresh !== true && cached && cached.expires > Date.now())
      return res.json({ ok: true, ...cached.value });
    let work = pending.get(key);
    if (!work) {
      if (pending.size >= 16) return res.status(503).json({ ok: false, error: "Marketplace updates are busy. They will retry shortly." });
      work = fetchProfileOffers(login, skip, AbortSignal.timeout(12000)).finally(() => pending.delete(key));
      pending.set(key, work);
    }
    const value = await work;
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { value, expires: Date.now() + 60000 });
    return res.json({ ok: true, ...value });
  } catch (error) { return res.status(502).json({ ok: false, error: (error as Error).message }); }
}
