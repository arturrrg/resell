import assert from "node:assert/strict";
import { test } from "node:test";
import { LISTING_UNAVAILABLE } from "../shared/refresh";
import { confirmedUnavailableAdverts, profileAbsences, publicationIsVisible } from "../web/offers/publication-presence";

test("a cached profile miss cannot hide a published advert after restart", () => {
  const candidates = ["123456", "234567", "345678"];
  const first = profileAbsences(candidates, new Set(["345678"]), [], 1_000);
  assert.equal(first.confirmed.size, 0);
  const restarted = profileAbsences(candidates, new Set(["345678"]), first.pending, 61_000);
  assert.equal(restarted.confirmed.size, 0);
  const fresh = profileAbsences(candidates, new Set(["123456"]), restarted.pending, 121_000);
  assert.deepEqual([...fresh.confirmed], ["234567"]);
  assert.deepEqual(fresh.pending, [["345678", 121_000]]);
});

test("a confirmed missing listing hides even when its profile still shows it", () => {
  assert.equal(publicationIsVisible({ monitorActive: true, sourceAvailability: "unavailable" }), false);
  assert.equal(publicationIsVisible({ monitorActive: false }), false);
  assert.equal(publicationIsVisible({ monitorActive: true, sourceAvailability: "Available" }), true);
  assert.equal(publicationIsVisible(), true);
});

test("a first profile miss can be confirmed by a typed importer 404", async () => {
  const unavailable = await confirmedUnavailableAdverts(
    ["105967410", "234567", "345678"],
    "https://resell.example",
    new AbortController().signal,
    async (input, options) => {
      assert.equal(input, "https://resell.example/api/import-999");
      const { url, refresh } = JSON.parse(String(options?.body));
      assert.equal(refresh, true);
      if (url.endsWith("/105967410"))
        return Response.json({ code: LISTING_UNAVAILABLE }, { status: 404 });
      if (url.endsWith("/234567"))
        return Response.json({ error: "Missing route" }, { status: 404 });
      return Response.json({ error: "Marketplace busy" }, { status: 429 });
    },
  );
  assert.deepEqual([...unavailable], ["105967410"]);
  const first = profileAbsences(["105967410", "234567", "345678"], new Set(), [], 1_000, unavailable);
  assert.deepEqual([...first.confirmed], ["105967410"]);
  assert.deepEqual(first.pending, [["234567", 1_000], ["345678", 1_000]]);
});
