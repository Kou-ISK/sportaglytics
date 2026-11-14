import type { RetainedExportDirectory } from '../../../src/types/ipc/exportProgressWindow';

type Records = { directories: RetainedExportDirectory[]; locationUnknown: boolean };
const records = new WeakMap<object, Records>();
/** Informational evidence only: never grants deletion authority. */
export const rememberRetained = (error: unknown, entry?: RetainedExportDirectory): void => {
  if ((typeof error !== 'object' && typeof error !== 'function') || error === null) return;
  const prior = records.get(error) ?? { directories: [], locationUnknown: false };
  if (!entry) prior.locationUnknown = true;
  else if (!prior.directories.some((item) => item.id === entry.id)) prior.directories.push(entry);
  records.set(error, prior);
};
export const retainedFor = (error: unknown): Records =>
  ((typeof error === 'object' || typeof error === 'function') && error !== null && records.get(error)) || { directories: [], locationUnknown: false };

export const transferRetained = (from: unknown, to: unknown): void => {
  const saved = retainedFor(from);
  for (const entry of saved.directories) rememberRetained(to, entry);
  if (saved.locationUnknown) rememberRetained(to);
};

export const normalizeExportError = (error: unknown): object =>
  ((typeof error === 'object' && error !== null) || typeof error === 'function')
    ? error as object
    : Object.assign(new Error('Export failed'), { cause: error });
