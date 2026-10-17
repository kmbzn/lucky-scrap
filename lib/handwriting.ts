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
  if (!process.env.GOOGLE_VISION_API_KEY?.trim())
    throw new Error("인증 기능 설정 필요: 필기 인식 API 키가 없습니다");
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.GOOGLE_VISION_API_KEY.trim())}`,
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
  const body = await res.json();
  const result = body.responses?.[0];
  const error = body.error || result?.error;
  if (!res.ok || error) {
    const reason = error?.details?.find(
      (detail: { reason?: string }) => detail.reason,
    )?.reason;
    if (reason === "SERVICE_DISABLED")
      throw new Error(
        "Cloud Vision API를 Google Cloud 프로젝트에서 활성화해 주세요",
      );
    if (reason === "BILLING_DISABLED")
      throw new Error("Google Cloud 프로젝트의 결제 설정을 확인해 주세요");
    if (reason === "API_KEY_INVALID")
      throw new Error("필기 인식 API 키가 유효하지 않습니다");
    if (res.status === 429 || error?.code === 429)
      throw new Error(
        "필기 인식 API 할당량을 초과했습니다. 잠시 후 다시 시도해 주세요",
      );
    if (res.status === 401 || res.status === 403 || error?.code === 403)
      throw new Error(
        "필기 인식 API 권한을 확인해 주세요. Cloud Vision 활성화·키 제한·결제 설정이 필요합니다",
      );
    throw new Error(
      "필기 인식 서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요",
    );
  }
  const text = (result?.fullTextAnnotation?.text || "")
    .normalize("NFC")
    .replace(/\s/g, "");
  return text === expected;
}
