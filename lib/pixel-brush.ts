export const BOARD_PIXELS = 80;
export const LOGICAL_SIZE = 320;
export const BRUSH_PIXELS = 3;
export type PixelPoint = { x: number; y: number };
export function boardPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): PixelPoint {
  return {
    x: Math.max(
      0,
      Math.min(
        BOARD_PIXELS - 1,
        Math.floor(((clientX - rect.left) / rect.width) * BOARD_PIXELS),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        BOARD_PIXELS - 1,
        Math.floor(((clientY - rect.top) / rect.height) * BOARD_PIXELS),
      ),
    ),
  };
}
// Integer Bresenham interpolation keeps fast strokes connected without antialiasing.
export function rasterLine(from: PixelPoint, to: PixelPoint): PixelPoint[] {
  const points: PixelPoint[] = [];
  let x = from.x,
    y = from.y;
  const dx = Math.abs(to.x - x),
    dy = -Math.abs(to.y - y),
    sx = x < to.x ? 1 : -1,
    sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) break;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
  return points;
}
export function paintPixelStroke(
  ctx: Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">,
  from: PixelPoint,
  to: PixelPoint,
) {
  ctx.fillStyle = "#244c38";
  for (const p of rasterLine(from, to)) {
    // Three-pixel rounded tip, about 12px wide on a 320px writing board.
    ctx.fillRect(p.x - 1, p.y, BRUSH_PIXELS, 1);
    ctx.fillRect(p.x, p.y - 1, 1, BRUSH_PIXELS);
  }
}
