// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { exportPublicationScope, offerExportPublication } from './exportPublicationLease';
import type { ExportPublicationScope } from './exportPublicationLease';
const lease = () => ({ publish: vi.fn(async () => undefined), release: vi.fn(async () => undefined) });
it('does not transfer to a different target or outside a transaction', () => {
  const value = lease();
  expect(offerExportPublication('/stage', value)).toBe(false);
  const scope: ExportPublicationScope = { stagingPath: '/stage', accepting: true };
  exportPublicationScope.run(scope, () => expect(offerExportPublication('/other', value)).toBe(false));
  expect(scope.lease).toBeUndefined();
});
it('accepts one owner and rejects a second', () => {
  const value = lease();
  const scope: ExportPublicationScope = { stagingPath: '/stage', accepting: true };
  exportPublicationScope.run(scope, () => {
    expect(offerExportPublication('/stage', value)).toBe(true);
    expect(() => offerExportPublication('/stage', lease())).toThrow('already has an owner');
  });
  expect(scope.lease).toBe(value);
});
it('does not accept a stale render callback after rendering ends', () => {
  const scope: ExportPublicationScope = { stagingPath: '/stage', accepting: false };
  exportPublicationScope.run(scope, () => expect(offerExportPublication('/stage', lease())).toBe(false));
  expect(scope.lease).toBeUndefined();
});
