// Recover artwork hidden by the source sheet's inset alpha cutoff.
// RGB pixels stay untouched. The six-pixel perimeter excludes the sheet grid.
export function restoreSpriteAlpha(data, width, height, channels = 4) {
  const result = Buffer.from(data);
  const visited = new Uint8Array(width * height);
  const queue = [];
  for (let y = 6; y < height - 6; y++) {
    for (let x = 6; x < width - 6; x++) {
      const index = y * width + x;
      if (data[index * channels + 3]) {
        visited[index] = 1;
        queue.push(index);
      }
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 6 || ny < 6 || nx >= width - 6 || ny >= height - 6) continue;
      const next = ny * width + nx;
      if (visited[next]) continue;
      visited[next] = 1;
      const offset = next * channels;
      const brightest = Math.max(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      // Artwork colors and black outlines; the dark blue-gray background is excluded.
      if (brightest <= 16 || brightest >= 65) {
        result[offset + 3] = 255;
        queue.push(next);
      }
    }
  }
  return result;
}
