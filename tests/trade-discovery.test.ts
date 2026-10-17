import { test } from "node:test";
import assert from "node:assert/strict";
import { assertDiscoveredTrade } from "../lib/trade-discovery";

test("trade rejects undiscovered items on either side", () => {
  for (const lines of [
    [{ itemId: 1 }, { itemId: 2 }],
    [{ itemId: 2 }, { itemId: 1 }],
  ])
    assert.throws(() => assertDiscoveredTrade(lines, new Set([1])), /도감/);
});

test("previously discovered items remain eligible regardless of current holdings", () => {
  assert.doesNotThrow(() =>
    assertDiscoveredTrade([{ itemId: 1 }, { itemId: 2 }], new Set([1, 2])),
  );
});
