import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile, readdir } from "node:fs/promises";
import { items, baseMaterials, maxCraft } from "../lib/items";
import {
  renderHandwriting,
  strokesSchema,
  recognize,
} from "../lib/handwriting";
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
  assert.equal(baseMaterials(62)["17"], 64);
  assert.equal(baseMaterials(63)["17"], 86);
  assert.equal(maxCraft(24, { "5": 5 }), 2);
  assert.equal(maxCraft(24, {}), 0);
  assert.deepEqual(baseMaterials(25), { "5": 4 });
});
test("original file preserved and 64 crops retain exact RGBA pixels", async () => {
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
    assert.equal(crop.info.width, edges[x + 1] - edges[x]);
    assert.equal(crop.info.height, edges[y + 1] - edges[y]);
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
    assert.deepEqual(crop.data, expected);
    if (id === 0)
      for (let i = 3; i < crop.data.length; i += 4)
        assert.equal(crop.data[i], 0);
  }
});
test("handwriting rejects empty, instantaneous, out-of-bounds and backwards events", () => {
  for (const v of [
    [],
    [
      [
        { x: 1, y: 1, t: 0 },
        { x: 2, y: 2, t: 0 },
      ],
    ],
    [[{ x: 400, y: 1, t: 0 }]],
  ])
    assert.equal(strokesSchema.safeParse(v).success, false);
});
test("server render ignores timestamps for replay fingerprint and missing OCR never grants", async () => {
  const stroke = Array.from({ length: 10 }, (_, i) => ({
    x: 20 + i * 10,
    y: 20 + i * 5,
    t: i * 40,
  }));
  const a = await renderHandwriting([stroke]);
  const b = await renderHandwriting([
    stroke.map((p) => ({ ...p, t: p.t + 100 })),
  ]);
  assert.equal(a.hash, b.hash);
  const prev = process.env.GOOGLE_VISION_API_KEY;
  delete process.env.GOOGLE_VISION_API_KEY;
  try {
    await assert.rejects(recognize(a.image, "가"), /인증 기능 설정 필요/);
  } finally {
    if (prev) process.env.GOOGLE_VISION_API_KEY = prev;
  }
});
