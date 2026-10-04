/** Resolve package media references consistently in Main and Renderer. */
export const isAbsoluteMediaReference = (reference: string): boolean =>
  /^(?:file:|[A-Za-z]:[\\/]|[\\/])/i.test(reference);

export const resolvePackageMediaPath = (
  packagePath: string,
  reference: string,
): string => {
  if (!reference || reference.includes('\0'))
    throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
  if (/^file:/i.test(reference)) {
    const url = new URL(reference);
    if (
      url.protocol !== 'file:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /%2f|%5c/i.test(url.pathname)
    )
      throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0'))
      throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
    if (/^\/[A-Za-z]:\//.test(pathname)) pathname = pathname.slice(1);
    return url.hostname && url.hostname !== 'localhost'
      ? `//${url.hostname}${pathname}`
      : pathname;
  }
  const normalized = reference.replace(/\\/g, '/');
  if (
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) &&
    !/^[A-Za-z]:\//.test(normalized)
  )
    throw new Error('PACKAGE_MEDIA_REFERENCE_INVALID');
  return isAbsoluteMediaReference(normalized)
    ? normalized
    : `${packagePath.replace(/\\/g, '/').replace(/\/$/, '')}/${normalized}`;
};
