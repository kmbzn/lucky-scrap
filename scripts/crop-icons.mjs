import { copyFile, mkdir, access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const original = path.join(root, "items.png");
const target = path.join(root, "public/items.png");
await mkdir(path.join(root, "public/item-icons"), { recursive: true });
try {
  await access(original);
  await copyFile(original, target);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const meta = await sharp(target).metadata();
if (meta.width !== 1254 || meta.height !== 1254 || meta.channels !== 4) {
  throw new Error("원본 이미지는 1254×1254 RGBA여야 합니다.");
}
const padding = 12;
const edges = [0, 157, 314, 470, 627, 784, 940, 1097, 1254];
for (let id = 0; id < 64; id++) {
  const col = id % 8;
  const row = Math.floor(id / 8);
  await sharp(target)
    .extract({
      left: edges[col],
      top: edges[row],
      width: edges[col + 1] - edges[col],
      height: edges[row + 1] - edges[row],
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(
      path.join(root, `public/item-icons/${String(id).padStart(3, "0")}.png`),
    );
}
const blank = await sharp(path.join(root, "public/item-icons/000.png"))
  .raw()
  .toBuffer();
for (let p = 3; p < blank.length; p += 4)
  if (blank[p] !== 0) throw new Error("000은 완전 투명해야 합니다.");
console.log(
  "64 icons cropped with transparent safety padding; original RGBA pixels preserved.",
);

// App branding uses the original 002 leaf crop; source sprite pixels stay untouched.
const leaf = path.join(root, "public/item-icons/002.png");
await mkdir(path.join(root, "public/icons"), { recursive: true });
async function appIcon(size, artSize, output) {
  const artwork = await sharp(leaf)
    .resize(artSize, artSize, { kernel: "nearest" })
    .png()
    .toBuffer();
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: "#f7f5ee" },
  })
    .composite([{ input: artwork, gravity: "centre" }])
    .png()
    .toBuffer();
  await sharp(composed)
    .flatten({ background: "#f7f5ee" })
    .removeAlpha()
    .png()
    .toFile(path.join(root, output));
}
await appIcon(192, 160, "public/icons/leaf-192.png");
await appIcon(512, 432, "public/icons/leaf-512.png");
await appIcon(512, 288, "public/icons/leaf-maskable-512.png");
await appIcon(180, 144, "app/apple-icon.png");
await copyFile(
  path.join(root, "public/icons/leaf-512.png"),
  path.join(root, "app/icon.png"),
);
const sizes = [16, 32];
const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(leaf).resize(size, size, { kernel: "nearest" }).png().toBuffer(),
  ),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const pos = 6 + 16 * i;
  header[pos] = sizes[i];
  header[pos + 1] = sizes[i];
  header.writeUInt16LE(1, pos + 4);
  header.writeUInt16LE(32, pos + 6);
  header.writeUInt32LE(pngs[i].length, pos + 8);
  header.writeUInt32LE(offset, pos + 12);
  offset += pngs[i].length;
}
await writeFile(
  path.join(root, "app/favicon.ico"),
  Buffer.concat([header, ...pngs]),
);
console.log("Leaf app icons generated for browser, iOS and Android.");
