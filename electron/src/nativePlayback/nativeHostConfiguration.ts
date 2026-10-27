/** Main supplies only the qualified source. AVPlayer owns its media pipeline. */
export const nativeHostConfiguration = (
  source: string,
): { version: 1; source: string } => ({ version: 1, source });
