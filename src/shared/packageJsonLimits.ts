/** Package compatibility reads and Timeline saves must agree on UTF-8 bytes. */
export const MAX_PACKAGE_JSON_BYTES = 16 * 1024 * 1024;

export const isWithinPackageJsonSizeLimit = (content: string): boolean =>
  // Every UTF-16 code unit needs at least one UTF-8 byte; avoid a large extra
  // allocation for content that is already too long even before encoding.
  content.length <= MAX_PACKAGE_JSON_BYTES &&
  new TextEncoder().encode(content).byteLength <= MAX_PACKAGE_JSON_BYTES;
