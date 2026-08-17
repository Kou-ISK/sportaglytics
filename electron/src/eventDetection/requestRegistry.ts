import type { ChildProcess } from 'child_process';

const activeRequests = new Map<string, ChildProcess>();

export const registerEventDetectionProcess = (
  requestId: string,
  process: ChildProcess,
): void => {
  activeRequests.set(requestId, process);
};

export const unregisterEventDetectionProcess = (requestId: string): void => {
  activeRequests.delete(requestId);
};

export const cancelEventDetectionProcess = (requestId: string): boolean => {
  const process = activeRequests.get(requestId);
  if (!process) return false;
  activeRequests.delete(requestId);
  if (!process.killed) {
    process.kill('SIGTERM');
  }
  return true;
};
