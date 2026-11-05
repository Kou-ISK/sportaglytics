import { resolveSignedCommandInput } from '../nativePlayback/runtime/nativeResources';
import type { NativeMonitor } from './commandLeftMain';

/** Only Main loads the fixed addon from the verified signed native resource set. */
export const loadSignedCommandLeftMonitor = async (
  resources: string,
  state: string,
): Promise<NativeMonitor> => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw Error('NATIVE_COMMAND_UNSUPPORTED');
  const file = await resolveSignedCommandInput(resources, state);
  const raw: unknown = require(file);
  if (!raw || typeof raw !== 'object' ||
      !('start' in raw) || typeof raw.start !== 'function' ||
      !('reset' in raw) || typeof raw.reset !== 'function' ||
      !('health' in raw) || typeof raw.health !== 'function' ||
      !('stop' in raw) || typeof raw.stop !== 'function' ||
      !('matchesWindow' in raw) || typeof raw.matchesWindow !== 'function')
    throw Error('NATIVE_COMMAND_INVALID_ADDON');
  const { start, reset, health, stop, matchesWindow } = raw;
  return {
    start: (callback) => { start(callback); },
    reset: () => { const result: unknown = reset(); if (typeof result !== 'number') throw Error('NATIVE_COMMAND_INVALID_RESET'); return result; },
    health: (): unknown => health(),
    stop: () => { stop(); },
    matchesWindow: (handle, number) => {
      const result: unknown = matchesWindow(handle, number);
      if (typeof result !== 'boolean') throw Error('NATIVE_COMMAND_INVALID_WINDOW');
      return result;
    },
  };
};
