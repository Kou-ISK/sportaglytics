let binding: { source: string; token: symbol } | null = null;
const listeners = new Set<() => void>();
export const nativeSurfaceSource = (): string | null => binding?.source ?? null;
export const subscribeNativeSurface = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = (): void => {
  for (const listener of listeners) listener();
};
export const hasNativeSurface = (source: string): boolean =>
  binding?.source === source;
export const registerNativeSurface = (source: string): (() => void) => {
  if (binding) throw Error('NATIVE_SURFACE_ALREADY_BOUND');
  const token = Symbol('native surface');
  binding = { source, token };
  notify();
  return () => {
    if (binding?.token === token) {
      binding = null;
      notify();
    }
  };
};
