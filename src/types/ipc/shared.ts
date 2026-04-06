export type UnknownRecord = Record<string, unknown>;

export const isPlainObject = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every(isString);
};

export const isOptional = <T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): value is T | undefined => {
  return value === undefined || guard(value);
};

export const isStringOrNull = (value: unknown): value is string | null => {
  return value === null || isString(value);
};

export const isArrayOf = <T>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): value is T[] => {
  return Array.isArray(value) && value.every(guard);
};
