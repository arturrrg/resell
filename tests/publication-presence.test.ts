import assert from "node:assert/strict";
import { test } from "node:test";
import { profileAbsences, publicationIsVisible } from "../web/offers/publication-presence";

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

test("the profile monitor controls visibility for marketplace receipts", () => {
  const failedRefresh = { sourceAvailability: "unavailable" };
  assert.equal(publicationIsVisible(failedRefresh, true), true);
  assert.equal(publicationIsVisible({ ...failedRefresh, monitoredAccount: "seller" }), true);
  assert.equal(publicationIsVisible({ monitorActive: false }, true), false);
  assert.equal(publicationIsVisible(failedRefresh), false);
});
