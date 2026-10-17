import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAW_DELAY_MS, revealDraw } from "../lib/draw";

test("a prepared reward is revealed at 3 seconds without another server delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let elapsed = false;
  let revealed = false;
  const result = revealDraw(Promise.resolve({ itemId: 16 }), () => {
    elapsed = true;
  });
  void result.then(() => {
    revealed = true;
  });
  t.mock.timers.tick(DRAW_DELAY_MS - 1);
  await Promise.resolve();
  assert.equal(elapsed, false);
  assert.equal(revealed, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await result, { itemId: 16 });
  assert.equal(elapsed, true);
});

test("a slow response ends the progress animation at 3 seconds and preserves the real reward", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish!: (value: number) => void;
  let elapsed = false;
  const request = new Promise<number>((resolve) => {
    finish = resolve;
  });
  const result = revealDraw(request, () => {
    elapsed = true;
  });
  t.mock.timers.tick(3000);
  assert.equal(elapsed, true);
  finish(23);
  assert.equal(await result, 23);
});

test("a failed request cancels its animation callback before another draw", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let elapsed = false;
  await assert.rejects(
    revealDraw(Promise.reject(new Error("offline")), () => {
      elapsed = true;
    }),
    /offline/,
  );
  t.mock.timers.tick(3000);
  assert.equal(elapsed, false);
});
