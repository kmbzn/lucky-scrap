import { test } from "node:test";
import assert from "node:assert/strict";
import { itemName, matchesItem } from "../lib/discovery";
import { items } from "../lib/items";
test("unknown names are masked and cannot be inferred by name search", () => {
  const discovered = new Set([1]);
  for (const item of items) {
    assert.equal(
      itemName(item.id, discovered),
      item.id === 1 ? item.name : "???",
    );
    if (item.id !== 1)
      assert.equal(matchesItem(item.id, item.name, discovered), false);
  }
  assert.equal(matchesItem(1, items[1].name, discovered), true);
});
test("persistent discoveries reveal names independently of inventory quantities", () => {
  const discovered = new Set([24, 63]);
  assert.equal(itemName(24, discovered), "실");
  assert.equal(itemName(63, discovered), "우승 트로피");
  assert.equal(itemName(25, discovered), "???");
});
