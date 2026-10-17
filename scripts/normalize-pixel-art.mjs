// Match the approved preview: box sampling, 17-step RGB palette, and a
// one-pixel outline made by shifting the body mask in four directions.
export function normalizePixelArt(data, width, height, size = 48) {
  const body = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0,
        red = 0,
        green = 0,
        blue = 0,
        count = 0;
      for (
        let sy = Math.round((y * height) / size);
        sy < Math.round(((y + 1) * height) / size);
        sy++
      ) {
        for (
          let sx = Math.round((x * width) / size);
          sx < Math.round(((x + 1) * width) / size);
          sx++
        ) {
          const offset = (sy * width + sx) * 4,
            a = data[offset + 3];
          alpha += a;
          red += data[offset] * a;
          green += data[offset + 1] * a;
          blue += data[offset + 2] * a;
          count++;
        }
      }
      if (!alpha || Math.round(alpha / count) < 128) continue;
      const rgb = [red, green, blue].map((value) => Math.round(value / alpha));
      if (Math.max(...rgb) <= 24) continue;
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++)
        body[offset + c] = Math.round(rgb[c] / 17) * 17;
      body[offset + 3] = 255;
    }
  }
  const result = Buffer.alloc(body.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!body[(y * size + x) * 4 + 3]) continue;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const offset = (ny * size + nx) * 4;
        result.set([17, 17, 17, 255], offset);
      }
    }
  }
  for (let offset = 0; offset < body.length; offset += 4)
    if (body[offset + 3]) result.set(body.subarray(offset, offset + 4), offset);

  // Flood only exterior transparency; every remaining enclosed hole is black.
  const outside = new Uint8Array(size * size),
    queue = [];
  for (let index = 0; index < size * size; index++) {
    const x = index % size,
      y = Math.floor(index / size);
    if (
      (x === 0 || y === 0 || x === size - 1 || y === size - 1) &&
      !result[index * 4 + 3]
    ) {
      outside[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor],
      x = index % size,
      y = Math.floor(index / size);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (!outside[next] && !result[next * 4 + 3]) {
        outside[next] = 1;
        queue.push(next);
      }
    }
  }
  for (let index = 0; index < outside.length; index++)
    if (!outside[index] && !result[index * 4 + 3])
      result.set([17, 17, 17, 255], index * 4);
  return result;
}
