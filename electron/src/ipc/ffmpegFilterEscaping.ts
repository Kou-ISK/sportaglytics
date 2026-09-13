/** Escape AVOption syntax, then the enclosing filtergraph (no shell involved). */
export const escapeFilterOption = (value: string): string =>
  value.replace(/[\\':]/g, '\\$&').replace(/[\\'\[\],;]/g, '\\$&');
