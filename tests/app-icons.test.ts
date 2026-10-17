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
