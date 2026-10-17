import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAW_DELAY_MS, waitForDraw } from "../lib/draw";
test("server waits three seconds before allowing reward finalization", async () => {
  assert.equal(DRAW_DELAY_MS, 3000);
  const started = performance.now();
  await waitForDraw();
  assert.ok(
    performance.now() - started >= 2995,
    "reward must not finalize before three seconds",
  );
});
