export const DRAW_DELAY_MS = 3000;

// Prepare the reward during the reveal animation, not after it.
export async function revealDraw<T>(
  request: Promise<T>,
  onAnimationComplete: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const animation = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      onAnimationComplete();
      resolve();
    }, DRAW_DELAY_MS);
  });
  try {
    const [result] = await Promise.all([request, animation]);
    return result;
  } finally {
    clearTimeout(timer!);
  }
}
