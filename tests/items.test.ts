import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { items, baseMaterials, maxCraft } from "../lib/items";
import { strokesSchema } from "../lib/handwriting";
test("64 items, 23 natural weights total 1000, 40 exact recipes", () => {
  assert.equal(items.length, 64);
  assert.equal(items.filter((i) => i.weight > 0).length, 23);
  assert.equal(
    items.reduce((a, i) => a + i.weight, 0),
    1000,
  );
  assert.equal(items.filter((i) => Object.keys(i.recipe).length).length, 40);
  for (const i of items) {
    assert.equal(i.id, items.indexOf(i));
    if (i.weight > 0) assert.ok(i.id > 0 && i.id < 24);
    for (const [key, n] of Object.entries(i.recipe)) {
      assert.ok(Number(key) < i.id);
      assert.ok(Number.isInteger(n) && n > 0);
    }
  }
});
test("recursive gold balance and craft availability", () => {
  assert.equal(baseMaterials(62)["17"], 16);
  assert.equal(baseMaterials(63)["17"], 30);
  assert.equal(baseMaterials(63)["22"], undefined);
  assert.equal(baseMaterials(63)["18"], 1);
  assert.equal(maxCraft(24, { "5": 5 }), 2);
  assert.equal(maxCraft(24, {}), 0);
  assert.deepEqual(baseMaterials(25), { "5": 4 });
});
test("all 64 editable icons use a transparent 48px grid", async () => {
  assert.equal(
    (await readdir("public/item-icons")).filter((n) => n.endsWith(".png"))
      .length,
    64,
  );
  for (let id = 0; id < 64; id++) {
    const { data, info } = await sharp(
      `public/item-icons/${String(id).padStart(3, "0")}.png`,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 48);
    assert.equal(info.height, 48);
    let visible = 0;
    for (let index = 0; index < 48 * 48; index++) {
      const offset = index * 4,
        alpha = data[offset + 3];
      assert.ok(alpha === 0 || alpha === 255);
      if (alpha) {
        visible++;
        for (let c = 0; c < 3; c++) assert.equal(data[offset + c] % 17, 0);
      }
      const x = index % 48,
        y = Math.floor(index / 48);
      if (x === 0 || y === 0 || x === 47 || y === 47) assert.equal(alpha, 0);
    }
    if (id === 0) assert.equal(visible, 0);
    else assert.ok(visible > 100, `item ${id} must retain its artwork`);
  }
});
test("any drawing including one tap is accepted; empty or out-of-bounds input rejected", () => {
  assert.equal(
    strokesSchema.safeParse([[{ x: 10, y: 10, t: 0 }]]).success,
    true,
  );
  assert.equal(strokesSchema.safeParse([]).success, false);
  assert.equal(
    strokesSchema.safeParse([[{ x: 400, y: 10, t: 0 }]]).success,
    false,
  );
});

test("requested recipe costs and craft thresholds", () => {
  assert.deepEqual(items[26].recipe, { "6": 2 });
  assert.deepEqual(items[29].recipe, { "7": 1 });
  assert.deepEqual(items[43].recipe, { "1": 1, "8": 1 });
  assert.equal(maxCraft(26, { "6": 1 }), 0);
  assert.equal(maxCraft(26, { "6": 4 }), 2);
  assert.equal(maxCraft(43, { "1": 1, "8": 0 }), 0);
});

test("craft availability follows the loaded database recipe instead of bundled costs", () => {
  const catalog = items.map((item) => ({
    ...item,
    recipe: { ...item.recipe },
  }));
  catalog[38].recipe = { "17": 5 };
  assert.equal(maxCraft(38, { "17": 4 }, catalog), 0);
  assert.equal(maxCraft(38, { "17": 10 }, catalog), 2);
  assert.equal(maxCraft(38, { "17": 4 }), 2);
});
