import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));

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
await appIcon(192, 96, "public/icons/leaf-192.png");
await appIcon(512, 384, "public/icons/leaf-512.png");
await appIcon(512, 192, "public/icons/leaf-maskable-512.png");
await appIcon(180, 96, "app/apple-icon.png");
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
