import { z } from "zod";
// Only input bounds are checked. Any mark is accepted; no OCR service is called.
export const pointSchema = z.object({
  x: z.number().min(0).max(320),
  y: z.number().min(0).max(320),
  t: z.number().min(0).max(600000),
});
export const strokesSchema = z
  .array(z.array(pointSchema).min(1).max(2000))
  .min(1)
  .max(40)
  .refine(
    (strokes) => strokes.flat().length <= 6000,
    "입력한 선이 너무 많습니다",
  );
export type Stroke = z.infer<typeof pointSchema>[];
