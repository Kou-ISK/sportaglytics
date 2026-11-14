import { AsyncLocalStorage } from 'node:async_hooks';
import type { RetainedExportDirectory } from '../../../src/types/ipc/exportProgressWindow';

/** Main-only ownership transfer; never reconstructed from a renderer pathname. */
export interface ExportPublicationLease {
  publish: (target: string) => Promise<void>;
  release: (committed: boolean) => Promise<RetainedExportDirectory | undefined>;
}
export interface ExportPublicationScope {
  stagingPath: string;
  accepting: boolean;
  lease?: ExportPublicationLease;
}
export const exportPublicationScope = new AsyncLocalStorage<ExportPublicationScope>();
export const offerExportPublication = (stagingPath: string, lease: ExportPublicationLease): boolean => {
  const scope = exportPublicationScope.getStore();
  if (!scope || !scope.accepting || scope.stagingPath !== stagingPath) return false;
  if (scope.lease) throw new Error('Export publication already has an owner');
  scope.lease = lease;
  return true;
};
