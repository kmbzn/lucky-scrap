import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
export const pointSchema = z.object({
  x: z.number().min(0).max(320),
  y: z.number().min(0).max(320),
  t: z.number().min(0).max(600000),
});
export const strokesSchema = z
  .array(z.array(pointSchema).min(2).max(2000))
  .min(1)
  .max(40)
  .refine((strokes) => {
    const p = strokes.flat();
    return (
      p.length >= 8 &&
      p.length <= 6000 &&
      p[p.length - 1].t - p[0].t >= 200 &&
      p.every((v, i) => i === 0 || v.t >= p[i - 1].t)
    );
  }, "직접 글씨를 써 주세요");
export type Stroke = z.infer<typeof pointSchema>[];
export async function renderHandwriting(strokes: Stroke[]) {
  const paths = strokes
    .map(
      (s) => `<polyline points="${s.map((p) => `${p.x},${p.y}`).join(" ")}"/>`,
    )
    .join("");
  const image = await sharp(
    Buffer.from(
      `<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="320" fill="white"/><g fill="none" stroke="#111" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">${paths}</g></svg>`,
    ),
  )
    .png()
    .toBuffer();
  return { image, hash: createHash("sha256").update(image).digest("hex") };
}
export async function recognize(image: Buffer, expected: string) {
  if (!process.env.GOOGLE_VISION_API_KEY)
    throw new Error("인증 기능 설정 필요: 필기 인식 API 키가 없습니다");
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.GOOGLE_VISION_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["ko"] },
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error("필기 인식 서비스에 연결할 수 없습니다");
  const body = await res.json();
  const result = body.responses?.[0];
  if (result?.error) throw new Error("필기 인식 서비스 설정을 확인하세요");
  const text = (result?.fullTextAnnotation?.text || "")
    .normalize("NFC")
    .replace(/\s/g, "");
  return text === expected;
}
