import { copyFile, mkdir, access } from "node:fs/promises";
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
console.log("64 icons cropped with original RGBA pixels preserved.");
