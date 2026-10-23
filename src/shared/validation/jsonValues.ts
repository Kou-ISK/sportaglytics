/** Small JSON readers shared by Main and preload; no unpackaged runtime dependency. */
export const objectValue = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('INVALID_JSON_OBJECT');
  // Only object shape is asserted; every field remains unknown and is read separately.
  return value as Record<string, unknown>;
};
export const stringValue = (
  value: unknown,
  minimum = 0,
  maximum = Infinity,
): string => {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum
  )
    throw Error('INVALID_JSON_STRING');
  return value;
};
export const numberValue = (
  value: unknown,
  minimum = -Infinity,
  maximum = Infinity,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  )
    throw Error('INVALID_JSON_NUMBER');
  return value;
};
export const integerValue = (
  value: unknown,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  const result = numberValue(value, minimum, maximum);
  if (!Number.isSafeInteger(result)) throw Error('INVALID_JSON_INTEGER');
  return result;
};
export const booleanValue = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw Error('INVALID_JSON_BOOLEAN');
  return value;
};
export const arrayValue = (
  value: unknown,
  minimum = 0,
  maximum = Infinity,
): unknown[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum)
    throw Error('INVALID_JSON_ARRAY');
  return value;
};
export const enumValue = <const T extends string>(
  value: unknown,
  values: readonly T[],
): T => {
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) throw Error('INVALID_JSON_ENUM');
  return match;
};
export const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): void => {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw Error('INVALID_JSON_KEYS');
};
