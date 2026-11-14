/** Short exports retain the legacy admission path. */
export const requiresNativeV2Budget = (estimatedBytes: number): boolean => estimatedBytes > 8 * 1024 ** 3;
