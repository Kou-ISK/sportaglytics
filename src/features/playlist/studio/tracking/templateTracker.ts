export interface GrayFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
}
export interface TrackPoint {
  x: number;
  y: number;
}
export interface TrackMatch extends TrackPoint {
  confidence: number;
  reliable: boolean;
}
const vector = (
  frame: GrayFrame,
  x: number,
  y: number,
  radius: number,
): number[] => {
  const values: number[] = [];
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const stride = radius >= 8 ? 2 : 1;
  for (let dy = -radius; dy <= radius; dy += stride)
    for (let dx = -radius; dx <= radius; dx += stride)
      values.push(
        (1 - fy) *
          ((1 - fx) * frame.pixels[(iy + dy) * frame.width + ix + dx] +
            fx * frame.pixels[(iy + dy) * frame.width + ix + dx + 1]) +
          fy *
            ((1 - fx) * frame.pixels[(iy + dy + 1) * frame.width + ix + dx] +
              fx * frame.pixels[(iy + dy + 1) * frame.width + ix + dx + 1]),
      );
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
};
const inside = (
  frame: GrayFrame,
  x: number,
  y: number,
  radius: number,
): boolean =>
  x >= radius &&
  y >= radius &&
  x < frame.width - radius - 1 &&
  y < frame.height - radius - 1;
/** 画像の局所パターンを正規化相互相関で追跡する。低コントラスト/曖昧な一致は拒否。 */
export const matchTemplate = (
  reference: GrayFrame,
  at: TrackPoint,
  next: GrayFrame,
  searchRadius = 24,
  patchRadius = 8,
  searchCenter: TrackPoint = at,
  minimumConfidence = 0.72,
  subpixel = false,
): TrackMatch => {
  if (!inside(reference, at.x, at.y, patchRadius))
    return { ...at, confidence: 0, reliable: false };
  const template = vector(reference, at.x, at.y, patchRadius);
  const energy = template.reduce((sum, value) => sum + value * value, 0);
  if (energy / template.length < 25)
    return { ...at, confidence: 0, reliable: false };
  // 候補ごとの配列生成・平均除去を避ける。基準ベクトルは既に平均0。
  const scoreAt = (x: number, y: number): number => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const integer = fx === 0 && fy === 0;
    const stride = patchRadius >= 8 ? 2 : 1;
    let cross = 0,
      sum = 0,
      squares = 0,
      index = 0;
    for (let dy = -patchRadius; dy <= patchRadius; dy += stride) {
      for (let dx = -patchRadius; dx <= patchRadius; dx += stride) {
        const i = (iy + dy) * next.width + ix + dx;
        const value = integer
          ? next.pixels[i]
          : (1 - fy) * ((1 - fx) * next.pixels[i] + fx * next.pixels[i + 1]) +
            fy *
              ((1 - fx) * next.pixels[i + next.width] +
                fx * next.pixels[i + next.width + 1]);
        cross += template[index++] * value;
        sum += value;
        squares += value * value;
      }
    }
    const norm = squares - (sum * sum) / template.length;
    return norm > 0 ? cross / Math.sqrt(energy * norm) : 0;
  };
  const candidates: TrackMatch[] = [];
  for (
    let y = Math.round(searchCenter.y - searchRadius);
    y <= searchCenter.y + searchRadius;
    y++
  )
    for (
      let x = Math.round(searchCenter.x - searchRadius);
      x <= searchCenter.x + searchRadius;
      x++
    ) {
      if (!inside(next, x, y, patchRadius)) continue;
      candidates.push({ x, y, confidence: scoreAt(x, y), reliable: false });
    }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (!best) return { ...at, confidence: 0, reliable: false };
  const rival = candidates.find(
    (candidate) => Math.hypot(candidate.x - best.x, candidate.y - best.y) > 8,
  );
  let refined = best;
  if (
    subpixel &&
    best.confidence >= minimumConfidence &&
    best.confidence < 0.99999
  ) {
    // A fixed quarter-pixel grid accumulates its rounding error on every frame.
    // Refine only around the winning peak, down to 0.01 analysis pixels.
    for (const spacing of [0.25, 0.05, 0.01]) {
      const center = refined;
      for (let row = -3; row <= 3; row++)
        for (let column = -3; column <= 3; column++) {
          const x = center.x + column * spacing,
            y = center.y + row * spacing;
          if (!inside(next, x, y, patchRadius)) continue;
          const confidence = scoreAt(x, y);
          if (confidence > refined.confidence)
            refined = { x, y, confidence, reliable: false };
        }
    }
  }
  return {
    ...refined,
    reliable:
      best.confidence >= minimumConfidence &&
      (!rival || best.confidence - rival.confidence > 0.04),
  };
};
