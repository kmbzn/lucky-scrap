import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
test("leaf branding supplies valid browser, iOS and Android icon formats", async () => {
  const manifest = JSON.parse(
    await readFile("public/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.name, "Lucky Scrap");
  assert.ok(
    manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable"),
  );
  for (const icon of manifest.icons) {
    assert.ok(icon.src.includes("leaf-"));
    const meta = await sharp(`public${icon.src}`).metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes);
  }
  const ios = await sharp("app/apple-icon.png").metadata();
  assert.equal(ios.width, 180);
  assert.equal(ios.height, 180);
  assert.equal(ios.hasAlpha, false);
  assert.deepEqual(
    await readFile("app/icon.png"),
    await readFile("public/icons/leaf-512.png"),
  );
  const ico = await readFile("app/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 2);
  for (let i = 0; i < 2; i++) {
    const pos = 6 + i * 16;
    const offset = ico.readUInt32LE(pos + 12);
    const length = ico.readUInt32LE(pos + 8);
    const meta = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(meta.width, ico[pos]);
    assert.equal(meta.height, ico[pos + 1]);
  }
});
test("enlarged app artwork copies each source pixel into an exact 8 by 8 block", async () => {
  const source = await sharp("public/item-icons/002.png").raw().toBuffer();
  const { data, info } = await sharp("public/icons/leaf-512.png")
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const offset = (y * 48 + x) * 4;
      const expected = source[offset + 3]
        ? [...source.subarray(offset, offset + 3)]
        : [247, 245, 238];
      for (let dy = 0; dy < 8; dy++)
        for (let dx = 0; dx < 8; dx++) {
          const pixel =
            ((64 + y * 8 + dy) * 512 + 64 + x * 8 + dx) * info.channels;
          assert.deepEqual([...data.subarray(pixel, pixel + 3)], expected);
        }
    }
  }
});
