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

// Coal's dark interior was removed as if it were background. Only enclosed
// transparent regions are restored; the exterior remains transparent.
export function restoreEnclosedAlpha(data, width, height) {
  const result = Buffer.from(data);
  const outside = new Uint8Array(width * height);
  const queue = [0];
  outside[0] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor],
      x = index % width,
      y = Math.floor(index / width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (!outside[next] && !data[next * 4 + 3]) {
        outside[next] = 1;
        queue.push(next);
      }
    }
  }
  for (let index = 0; index < outside.length; index++)
    if (!outside[index]) result[index * 4 + 3] = 255;
  return result;
}
