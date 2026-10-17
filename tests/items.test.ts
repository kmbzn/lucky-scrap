import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile, readdir } from "node:fs/promises";
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
  assert.equal(baseMaterials(62)["17"], 138);
  assert.equal(baseMaterials(63)["17"], 336);
  assert.equal(maxCraft(24, { "5": 5 }), 1);
  assert.equal(maxCraft(24, {}), 0);
  assert.deepEqual(baseMaterials(25), { "5": 9 });
});
test("original file preserved and 64 padded crops retain exact RGBA pixels", async () => {
  assert.deepEqual(
    await readFile("items.png"),
    await readFile("public/items.png"),
  );
  const original = sharp("public/items.png");
  const meta = await original.metadata();
  assert.equal(meta.width, 1254);
  assert.equal(meta.height, 1254);
  assert.equal(meta.channels, 4);
  assert.equal(
    (await readdir("public/item-icons")).filter((n) => n.endsWith(".png"))
      .length,
    64,
  );
  const edges = [0, 157, 314, 470, 627, 784, 940, 1097, 1254];
  for (let id = 0; id < 64; id++) {
    const x = id % 8,
      y = Math.floor(id / 8);
    const crop = await sharp(
      `public/item-icons/${String(id).padStart(3, "0")}.png`,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(crop.info.width, edges[x + 1] - edges[x] + 24);
    assert.equal(crop.info.height, edges[y + 1] - edges[y] + 24);
    const expected = await original
      .clone()
      .extract({
        left: edges[x],
        top: edges[y],
        width: edges[x + 1] - edges[x],
        height: edges[y + 1] - edges[y],
      })
      .raw()
      .toBuffer();
    const interior = await sharp(crop.data, { raw: crop.info })
      .extract({
        left: 12,
        top: 12,
        width: edges[x + 1] - edges[x],
        height: edges[y + 1] - edges[y],
      })
      .raw()
      .toBuffer();
    assert.deepEqual(interior, expected);
    for (let row = 0; row < crop.info.height; row++)
      for (let col = 0; col < crop.info.width; col++)
        if (
          row < 12 ||
          col < 12 ||
          row >= crop.info.height - 12 ||
          col >= crop.info.width - 12
        )
          assert.equal(crop.data[(row * crop.info.width + col) * 4 + 3], 0);
    if (id === 0)
      for (let i = 3; i < crop.data.length; i += 4)
        assert.equal(crop.data[i], 0);
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
  assert.deepEqual(items[26].recipe, { "6": 4 });
  assert.deepEqual(items[29].recipe, { "7": 3 });
  assert.deepEqual(items[43].recipe, { "1": 2, "8": 2 });
  assert.equal(maxCraft(26, { "6": 3 }), 0);
  assert.equal(maxCraft(26, { "6": 8 }), 2);
  assert.equal(maxCraft(43, { "1": 2, "8": 1 }), 0);
});
