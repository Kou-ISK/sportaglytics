import { ipcMain, powerSaveBlocker } from 'electron';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPlaybackActivity } from './playbackActivity';
import { createSurfaceTransport } from './surfaceTransport';
import { createOwnedBackend } from './support/embedded-diagnostic/owned-backend.cjs';
import { createRecorder } from './support/recurrence/recorder.cjs';
import {
  createSessionDirectory,
  readNativeReceipt,
  removeOwnedSession,
} from './sessionStorage';
import { nativeHostConfiguration } from '../nativeHostConfiguration';
import { probeNativeHeader } from '../nativeHeaderProbe';
import type { NativePlaybackRuntime } from '../nativeSourceProvider';
import type { NativePlaybackBackend } from '../nativePlaybackSession';
import type { NativePlaybackClosed } from '../../../../src/types/ipc/nativePlayback';

export interface NativeRuntimePaths {
  host: string;
  receiver: string;
  state: string;
}

/** Constructed by Main after fixed resource validation.
 * No renderer-selected paths, persistent setting or raw event log is accepted. */
export const createNativePlaybackRuntime = (
  paths: NativeRuntimePaths,
): NativePlaybackRuntime => {
  let recorder: ReturnType<typeof createRecorder> | undefined;
  return {
    version: 1,
    probe: probeNativeHeader,
    createBackend: (
      window,
      source,
      _profile,
      assertCurrent,
      owner,
      observe,
    ) => {
      if (recorder === undefined)
        recorder = createRecorder(path.join(paths.state, 'recurrences'));
      const capture = recorder?.beginHost();
      let session: string | null = null,
        initialError: unknown,
        closeRequested = false,
        factoryAttempted = false;
      let backend: ReturnType<typeof createOwnedBackend> | null = null;
      let owned: NativePlaybackBackend | null = null;
      let surface: ReturnType<typeof createSurfaceTransport> | null = null;
      let activity: ReturnType<typeof createPlaybackActivity> | null = null;
      let closeWork: Promise<NativePlaybackClosed> | null = null;
      let receipt: Record<string, unknown> | null = null;
      const note = (
        kind: string,
        value: Record<string, unknown> = {},
      ): void => {
        try {
          capture?.note(kind, value);
        } catch {
          /* Optional fixed numeric ring. */
        }
        if (kind === 'native-drained') receipt = value;
        if (kind === 'host-spawn' && typeof value.pid === 'number')
          surface?.setPeer(value.pid);
        if (kind === 'issued') surface?.intent(value);
      };
      const endActivity = (): void => {
        activity?.stop();
      };
      const fail = (reason: string): void => {
        note('integration-failure', { reason });
        observe(null);
      };
      const onSurfaceError = (
        event: Electron.IpcMainEvent,
        value: unknown,
      ): void => {
        if (
          event.sender === window.webContents &&
          event.senderFrame === window.webContents.mainFrame
        )
          fail('paint: ' + String(value));
      };
      const closeSurface = async (): Promise<void> => {
        if (surface) {
          await surface.drain();
          surface.close();
        }
        ipcMain.removeListener('diagnostic-surface-error', onSurfaceError);
      };
      // Return a closeable owner before any filesystem/addon/process work.
      const initialization = Promise.resolve()
        .then(() => {
          if (closeRequested) return;
          session = createSessionDirectory(path.join(paths.state, 'sessions'));
          surface = createSurfaceTransport(
            paths.receiver,
            () => window,
            note,
            fail,
            true,
            (event, id): void => {
              try {
                capture?.surfaceStage(event, id);
              } catch {}
            },
          );
          surface.start();
          ipcMain.on('diagnostic-surface-error', onSurfaceError);
          const manifest = {
            ...nativeHostConfiguration(source),
            surfaceService: surface.service,
            surfaceOwnerPID: process.pid,
          };
          backend = createOwnedBackend({
            recurrence: capture,
            manifest,
            run: session,
            host: paths.host,
            note,
            surfaceReady: (id): void => {
              if (!surface) throw Error('NATIVE_SURFACE_MISSING');
              surface.ready(id);
            },
          });
          factoryAttempted = true;
          owned = backend.factory(owner, observe);
          activity = createPlaybackActivity(powerSaveBlocker);
          if (!activity.start().registered)
            throw Error('NATIVE_ACTIVITY_REGISTRATION');
        })
        .catch((error) => {
          initialError = error;
          note('initialization-failed');
        });

      return {
        reportFailure: (failure) => {
          try {
            capture?.rendererFailure(failure);
          } catch {}
        },
        write: async (intent) => {
          await initialization;
          if (initialError) throw initialError;
          if (closeRequested || !owned) throw Error('NATIVE_STARTUP_CANCELLED');
          await owned.write(intent);
        },
        close: (): Promise<NativePlaybackClosed> => {
          if (closeWork) return closeWork;
          closeRequested = true;
          closeWork = (async (): Promise<NativePlaybackClosed> => {
            await initialization;
            surface?.stopRequests();
            if (factoryAttempted && !owned)
              throw Error('NATIVE_INITIALIZATION_UNKNOWN');
            let closed: NativePlaybackClosed;
            try {
              closed = owned
                ? await owned.close()
                : {
                    generation: owner.generation,
                    processStarted: false,
                    processExited: true,
                    nativeDrained: true,
                    pipesClosed: true,
                    stopped: null,
                  };
              if (backend) await backend.done();
            } catch (error) {
              try {
                const termination = await backend?.termination();
                if (
                  termination?.generation !== owner.generation ||
                  termination.processExited !== true ||
                  termination.pipesClosed !== true
                )
                  throw Error('NATIVE_TERMINATION_UNCONFIRMED');
                // Physical closure permits the existing GPU ownership checks,
                // not a synthetic native drain or stopped playback clock.
                await closeSurface();
              } catch {
                note('surface-cleanup-unconfirmed');
              }
              throw error;
            }
            await closeSurface();
            endActivity();
            if (closed.processStarted) {
              if (!session) throw Error('NATIVE_SESSION_MISSING');
              const bytes = await readNativeReceipt(session);
              if (
                !receipt?.resultPersisted ||
                receipt.resultSHA256 !==
                  createHash('sha256').update(bytes).digest('hex')
              )
                throw Error('NATIVE_RECEIPT_MISMATCH');
              const value: unknown = JSON.parse(bytes.toString('utf8'));
              if (
                !value ||
                typeof value !== 'object' ||
                !('stoppedClock' in value) ||
                !isDeepStrictEqual(closed.stopped, value.stoppedClock)
              )
                throw Error('NATIVE_STOPPED_CLOCK_MISMATCH');
              try {
                await assertCurrent();
              } catch {
                note('source-qualification-expired');
              }
            } else {
              try {
                capture?.exit();
              } catch {}
            }
            if (session)
              try {
                await removeOwnedSession(session);
              } catch {
                /* Never erase pre-existing slots. */
              }
            return closed;
          })().catch((error) => {
            note('integration-failure');
            try {
              endActivity();
            } catch {
              /* Preserve original cleanup error. */
            }
            throw error;
          });
          return closeWork;
        },
      };
    },
  };
};
