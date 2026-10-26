let binding: { source: string; token: symbol } | null = null;
export const hasNativeSurface = (source: string): boolean =>
  binding?.source === source;
export const registerNativeSurface = (source: string): (() => void) => {
  if (binding) throw Error('NATIVE_SURFACE_ALREADY_BOUND');
  const token = Symbol('native surface');
  binding = { source, token };
  return () => {
    if (binding?.token === token) binding = null;
  };
};
