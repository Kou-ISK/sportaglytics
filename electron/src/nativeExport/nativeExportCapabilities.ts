import { runNativeCapabilityProbe } from './nativeExportProcess';

export type NativeExportCapability = 'legacy-v1' | 'budget-v2';

/** Only call after the signed resource set and hashes have been verified. */
export const detectNativeExportCapability = async (host: string, revision: 8 | 9, signal?: AbortSignal): Promise<NativeExportCapability> => {
  if (revision === 8) return 'legacy-v1';
  let raw: string;
  try { raw = await runNativeCapabilityProbe(host, signal); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Native export capability could not be verified');
  }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Invalid native export capability'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid native export capability');
  const item = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(['budgetFields', 'protocols', 'version']) || item.version !== 1 || JSON.stringify(item.protocols) !== '[1,2]' || JSON.stringify(item.budgetFields) !== '["maxOutputBytes","deadlineSeconds"]') throw new Error('Invalid native export capability');
  return 'budget-v2';
};
