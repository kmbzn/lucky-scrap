import { test } from "node:test";
import assert from "node:assert/strict";
import { boardPoint, rasterLine } from "../lib/pixel-brush";

test("writing coordinates scale to the pixel board and clamp outside touches", () => {
  const rect = { left: 10, top: 20, width: 320, height: 320 };
  assert.deepEqual(boardPoint(170, 180, rect), { x: 40, y: 40 });
  assert.deepEqual(boardPoint(-5, 1000, rect), { x: 0, y: 79 });
});

test("fast strokes stay connected in all drawing directions", () => {
  for (const target of [
    { x: 79, y: 3 },
    { x: 3, y: 79 },
    { x: 0, y: 0 },
  ]) {
    const start = { x: 40, y: 40 };
    const points = rasterLine(start, target);
    assert.deepEqual(points[0], start);
    assert.deepEqual(points.at(-1), target);
    points.slice(1).forEach((p, i) => {
      assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
      assert.ok(Math.abs(p.x - points[i].x) <= 1);
      assert.ok(Math.abs(p.y - points[i].y) <= 1);
    });
  }
});
