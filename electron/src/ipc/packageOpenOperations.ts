import type { PackageOpenProgress } from '../../../src/types/package/openProgress';

interface Operation {
  requestId: string;
  controller: AbortController;
  canCancel: boolean;
}

/** Cancellation is limited to read-only directory enumeration, never commit/recovery. */
export class PackageOpenOperations {
  private readonly owners = new Map<number, Operation>();

  begin(
    owner: number,
    requestId: string,
    notify: (state: PackageOpenProgress) => void,
  ): {
    signal: AbortSignal;
    directoryWaiting: (waiting: boolean) => void;
    finish: () => void;
  } {
    if (this.owners.has(owner)) throw new Error('PACKAGE_OPEN_BUSY');
    const operation: Operation = {
      requestId,
      controller: new AbortController(),
      canCancel: false,
    };
    this.owners.set(owner, operation);
    return {
      signal: operation.controller.signal,
      directoryWaiting: (waiting) => {
        if (this.owners.get(owner) !== operation) return;
        operation.canCancel = waiting && !operation.controller.signal.aborted;
        notify({
          requestId,
          phase: waiting ? 'backup-directory' : 'preparing',
          canCancel: operation.canCancel,
        });
      },
      finish: () => {
        if (this.owners.get(owner) === operation) this.owners.delete(owner);
      },
    };
  }

  cancel(owner: number, requestId: string): boolean {
    const operation = this.owners.get(owner);
    if (!operation || operation.requestId !== requestId || !operation.canCancel)
      return false;
    operation.canCancel = false;
    operation.controller.abort();
    return true;
  }

  /** A departed renderer may never consume this request. This signal only
   * interrupts read-only awaits/checkpoints; an active atomic update must finish. */
  abandon(owner: number, requestId: string): void {
    const operation = this.owners.get(owner);
    if (!operation || operation.requestId !== requestId) return;
    operation.canCancel = false;
    operation.controller.abort();
  }
}
