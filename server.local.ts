import { createServer } from "node:http";
import handler from "./api/import-999";
import exchangeHandler from "./api/exchange-rates";
import profileOffersHandler from "./api/profile-offers";
createServer(async (req, res) => {
  if (!["/api/import-999", "/api/exchange-rates", "/api/profile-offers"].includes(req.url || "")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) {
      res.writeHead(413).end();
      return;
    }
  }
  try {
    (req as any).body = JSON.parse(body || "{}");
    (res as any).status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    (res as any).json = (data: unknown) => res.end(JSON.stringify(data));
    res.setHeader("Content-Type", "application/json");
    await (req.url === "/api/exchange-rates" ? exchangeHandler : req.url === "/api/profile-offers" ? profileOffersHandler : handler)(
      req as any,
      res as any,
    );
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: "Invalid request." }));
  }
}).listen(4175, "127.0.0.1");
