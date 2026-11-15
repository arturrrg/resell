import type { VercelRequest, VercelResponse } from "@vercel/node";
import { latestRates } from "../server/exchange.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin,
    allowed = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  if (origin && allowed.includes(origin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "Use GET." });
  try {
    const rates = await latestRates();
    res.setHeader(
      "Cache-Control",
      rates.stale ? "no-store" : "public, max-age=60, s-maxage=300",
    );
    return res.json({ ok: true, rates });
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: "Exchange rates temporarily unavailable." });
  }
}
