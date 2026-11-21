import assert from "node:assert/strict";
import { test } from "node:test";
import { marketplaceLocation, normalizedOption } from "../shared/offer-form";

test("Chișinău spellings and damaged imports match the marketplace municipality", () => {
  for (const spelling of ["Chișinău", "Chişinău", "Chisinau", " Chi?in?u ", "Chi�inău", "Chisinau mun."]) {
    const location = marketplaceLocation(spelling);
    assert.equal(location, "Chișinău");
    assert.equal(normalizedOption(location), normalizedOption("Chișinău mun."));
  }
});

test("other locations and unknown spellings keep their original values", () => {
  for (const location of ["Bălți", "Cahul", "Chi?in?u suburb", "Chir?in?u", ""]) {
    assert.equal(marketplaceLocation(location), location);
  }
});
