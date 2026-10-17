import { test } from "node:test";
import assert from "node:assert/strict";
import { recognize } from "../lib/handwriting";

test("Vision request uses Korean handwriting OCR and requires exact one-character match", async (t) => {
  const old = process.env.GOOGLE_VISION_API_KEY;
  process.env.GOOGLE_VISION_API_KEY = "unit-test-key";
  let text = "가\n";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      const request = JSON.parse(options.body as string).requests[0];
      assert.equal(request.features[0].type, "DOCUMENT_TEXT_DETECTION");
      assert.deepEqual(request.imageContext.languageHints, ["ko"]);
      assert.equal(
        request.image.content,
        Buffer.from("unit-test-image").toString("base64"),
      );
      return Response.json({ responses: [{ fullTextAnnotation: { text } }] });
    },
  );
  try {
    assert.equal(await recognize(Buffer.from("unit-test-image"), "가"), true);
    text = "나";
    assert.equal(await recognize(Buffer.from("unit-test-image"), "가"), false);
    text = "가나";
    assert.equal(await recognize(Buffer.from("unit-test-image"), "가"), false);
    text = "";
    assert.equal(await recognize(Buffer.from("unit-test-image"), "가"), false);
  } finally {
    if (old === undefined) delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY = old;
  }
});
test("Vision API setup failures and quota failures never pass recognition", async (t) => {
  const old = process.env.GOOGLE_VISION_API_KEY;
  process.env.GOOGLE_VISION_API_KEY = "unit-test-key";
  let reason = "SERVICE_DISABLED",
    status = 403;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { code: status, details: [{ reason }] } },
      { status },
    ),
  );
  try {
    await assert.rejects(recognize(Buffer.from("test"), "가"), /활성화/);
    reason = "BILLING_DISABLED";
    await assert.rejects(recognize(Buffer.from("test"), "가"), /결제/);
    reason = "API_KEY_INVALID";
    status = 400;
    await assert.rejects(recognize(Buffer.from("test"), "가"), /유효하지/);
    reason = "QUOTA_EXCEEDED";
    status = 429;
    await assert.rejects(recognize(Buffer.from("test"), "가"), /할당량/);
  } finally {
    if (old === undefined) delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY = old;
  }
});
