export interface SourceClockFraction {
  value: number;
  scale: number;
}

/** Preserve the requested JS clock on conversion back from a bounded CMTime.
 * This is double round-trip equality, not equality of the binary rational.
 * Keep in sync with native/macos/playback/SourceClockFraction.hpp. */
export const sourceClockFraction = (
  seconds: number,
): SourceClockFraction | null => {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) return null;
  const nanos = Math.round(seconds * 1_000_000_000);
  if (nanos / 1_000_000_000 === seconds)
    return { value: nanos, scale: 1_000_000_000 };

  // Bounded continued-fraction convergents. Do not snap or accept a tolerance:
  // unsupported clocks still use the original player.
  let remainder = seconds;
  let previousValue = 0;
  let value = 1;
  let previousScale = 1;
  let scale = 0;
  for (let step = 0; step < 64; step += 1) {
    const coefficient = Math.floor(remainder);
    const nextValue = coefficient * value + previousValue;
    const nextScale = coefficient * scale + previousScale;
    if (
      !Number.isSafeInteger(nextValue) ||
      !Number.isSafeInteger(nextScale) ||
      nextScale < 1 ||
      nextScale > 1_000_000_000
    )
      return null;
    if (nextValue / nextScale === seconds)
      return { value: nextValue, scale: nextScale };
    const fraction = remainder - coefficient;
    if (!(fraction > 0)) return null;
    previousValue = value;
    value = nextValue;
    previousScale = scale;
    scale = nextScale;
    remainder = 1 / fraction;
  }
  return null;
};
