import type { ChildProcess } from 'child_process';

interface ActiveLlamaRequest {
  child: ChildProcess;
  cleanup: () => void;
  cancelled: boolean;
}

const activeRequests = new Map<string, ActiveLlamaRequest>();

export const registerLlamaRequest = (
  requestId: string,
  entry: Omit<ActiveLlamaRequest, 'cancelled'>,
): void => {
  activeRequests.set(requestId, { ...entry, cancelled: false });
};

export const unregisterLlamaRequest = (requestId: string): void => {
  activeRequests.delete(requestId);
};

export const isLlamaRequestCancelled = (requestId: string): boolean => {
  return activeRequests.get(requestId)?.cancelled === true;
};

export const cancelRegisteredLlamaRequest = (requestId: string): boolean => {
  if (!requestId) return false;
  const entry = activeRequests.get(requestId);
  if (!entry) return false;
  entry.cancelled = true;
  try {
    entry.cleanup();
  } catch (_error) {
    // ignore
  }
  try {
    entry.child.kill();
  } catch (_error) {
    // ignore
  }
  return true;
};
