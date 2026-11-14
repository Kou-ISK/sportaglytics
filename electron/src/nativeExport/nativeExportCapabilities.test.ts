import { expect, it, vi } from 'vitest';
import { detectNativeExportCapability } from './nativeExportCapabilities';
import { runNativeCapabilityProbe } from './nativeExportProcess';
vi.mock('./nativeExportProcess', () => ({ runNativeCapabilityProbe: vi.fn() }));
it('uses v1 for a verified legacy revision without probing', async () => {
  vi.mocked(runNativeCapabilityProbe).mockClear();
  expect(await detectNativeExportCapability('host', 8)).toBe('legacy-v1');
  expect(runNativeCapabilityProbe).not.toHaveBeenCalled();
});
it('accepts only the exact version 2 contract for the new revision', async () => {
  vi.mocked(runNativeCapabilityProbe).mockResolvedValue('{"version":1,"protocols":[1,2],"budgetFields":["maxOutputBytes","deadlineSeconds"]}');
  expect(await detectNativeExportCapability('host', 9)).toBe('budget-v2');
  for (const raw of ['', '{}', '{"version":2,"protocols":[1,2],"budgetFields":["maxOutputBytes","deadlineSeconds"]}', '{"version":1,"protocols":[1,2],"budgetFields":["maxOutputBytes","deadlineSeconds"],"extra":true}']) {
    vi.mocked(runNativeCapabilityProbe).mockResolvedValue(raw);
    await expect(detectNativeExportCapability('host', 9)).rejects.toThrow('Invalid native export capability');
  }
});
it('does not reinterpret errors or an unsupported response from a new host as legacy', async () => {
  vi.mocked(runNativeCapabilityProbe).mockRejectedValue(Object.assign(new Error('unsupported'), { exitCode: 64 }));
  await expect(detectNativeExportCapability('host', 9)).rejects.toThrow('could not be verified');
});

it('requires an explicit held-publication capability rather than inferring it from revision', async () => {
  vi.mocked(runNativeCapabilityProbe).mockResolvedValue('{"version":2,"protocols":[1,2],"budgetFields":["maxOutputBytes","deadlineSeconds"],"publication":"held-clone-v1"}');
  expect(await detectNativeExportCapability('host', 9)).toBe('budget-v2-held');
  vi.mocked(runNativeCapabilityProbe).mockResolvedValue('{"version":2,"protocols":[1,2],"budgetFields":["maxOutputBytes","deadlineSeconds"],"publication":"unknown"}');
  await expect(detectNativeExportCapability('host', 9)).rejects.toThrow('Invalid native export capability');
});
