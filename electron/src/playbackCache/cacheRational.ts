export const rational = (
  value: string,
): { numerator: number; denominator: number } => {
  const match = /^(-?\d+)\/(\d+)$/.exec(value);
  if (!match) throw Error('CACHE_INVALID_RATIONAL');
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator < 1
  )
    throw Error('CACHE_INVALID_RATIONAL');
  return { numerator, denominator };
};
export const canonicalSeconds = (
  ticks: number,
  timeBase: string,
  divisor = 1,
): string => {
  if (!Number.isSafeInteger(ticks)) throw Error('CACHE_UNSAFE_TIMESTAMP');
  const base = rational(timeBase);
  let a = BigInt(ticks) * BigInt(base.numerator);
  let b = BigInt(base.denominator) * BigInt(divisor);
  let x = a < 0n ? -a : a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  a /= x;
  b /= x;
  return String(a) + '/' + String(b);
};
