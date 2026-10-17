export const DRAW_DELAY_MS = 3000;
// A client cannot skip the reveal delay by removing its animation.
export function waitForDraw(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DRAW_DELAY_MS));
}
