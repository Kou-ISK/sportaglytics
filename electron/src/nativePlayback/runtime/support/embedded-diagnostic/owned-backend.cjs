'use strict';
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { createControlPipe } = require('../control-pipe.cjs');
const { assertNativeDrain } = require('../native-receipt.cjs');
const { cancellationGate } = require('../cancellation-gate.cjs');
const { parseSurfaceNotice } = require('./surface-notice.cjs');
const { packetLines } = require('./packet-lines.cjs');
const { attachAuxiliary } = require('../recurrence/auxiliary.cjs');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
module.exports.createOwnedBackend = (
  { manifest, run, host, note, surfaceReady, recurrence },
  dependencies = {},
) => {
  let stopped = false,
    child = null,
    backendClose = null,
    childDone = null,
    terminationDone = null,
    factoryUsed = false;
  const spawnOwned = dependencies.spawn || spawn,
    controlFactory = dependencies.createControlPipe || createControlPipe;
  const gate = cancellationGate(() => stopped);
  const factory = (owner, observe) => {
    if (factoryUsed) throw Error('host owner already created');
    factoryUsed = true;
    const close = deferred();
    const termination = deferred();
    childDone = close.promise;
    terminationDone = termination.promise;
    const generation = owner.generation;
    const confirmTermination = (processStarted) => {
      termination.resolve(
        Object.freeze({
          generation,
          processStarted,
          processExited: true,
          pipesClosed: true,
        }),
      );
    };
    let control = null,
      controlClosed = false,
      launchError = null;
    let receipt = null,
      actualExit = null,
      spawned = false,
      closed = false,
      closing = stopped,
      output = '',
      outputBytes = 0,
      stderrBytes = 0,
      writeFailure = null;
    const launch = deferred();
    const report = (kind, value = {}) => {
      try {
        note(kind, value);
      } catch (error) {
        writeFailure = String(error);
        // Logging must not steal ownership or throw out of a process callback.
        try {
          observe(null);
        } catch {}
        void backendClose?.().catch(() => {});
      }
    };
    // An async manifest write is owned before spawn, and close latches immediately.
    void (async () => {
      try {
        const m = {
          ...manifest,
          owner,
          ...(recurrence
            ? { recurrenceEnabled: true, recurrenceSession: recurrence.host }
            : {}),
        };
        await gate.wait(() =>
          fs.writeFile(path.join(run, 'manifest.json'), JSON.stringify(m), {
            flag: 'wx',
          }),
        );
        if (closing) {
          launch.resolve();
          confirmTermination(false);
          close.resolve({
            generation: owner.generation,
            nativeDrained: true,
            processStarted: false,
            processExited: true,
            pipesClosed: true,
            stopped: null,
          });
          return;
        }
        control = controlFactory(path.join(run, 'control.fifo'));
        await gate.beforeSpawn();
        if (closing) {
          await control.close();
          controlClosed = true;
          launch.resolve();
          confirmTermination(false);
          close.resolve({
            generation: owner.generation,
            nativeDrained: true,
            processStarted: false,
            processExited: true,
            pipesClosed: true,
            stopped: null,
          });
          return;
        }
        child = spawnOwned(
          host,
          [
            path.join(run, 'manifest.json'),
            path.join(run, 'native-run-1/native-result.json'),
            '--auto-no-ui-input',
          ],
          {
            stdio: recurrence
              ? [control.inputFd, 'pipe', 'pipe', 'pipe']
              : [control.inputFd, 'pipe', 'pipe'],
            cwd: run,
          },
        );
        attachAuxiliary(child, recurrence);
        child.once('spawn', () => {
          spawned = true;
          try {
            control.closeReader();
          } catch (error) {
            writeFailure = String(error);
            observe(null);
          }
          launch.resolve();
        });
        child.once('error', (e) => {
          launchError = e;
          writeFailure = String(e);
          launch.reject(e);
        });
        const packets = packetLines((value) => {
          if (value.type === 'observation') {
            report('observation', value.value);
            observe(value.value);
          } else if (value.type === 'surface-ready' && !receipt)
            surfaceReady(parseSurfaceNotice(value, owner.generation));
          else if (value.type === 'drained' && !receipt) {
            receipt = value;
            report('native-drained', value);
          } else throw Error('unexpected host packet');
        });
        child.once('exit', (code, signal) => {
          actualExit = { code, signal };
          report('host-exit', actualExit);
        });
        child.once('close', async (code, signal) => {
          output = packets.pending();
          closed = true;
          report('host-close', {
            outputBytes,
            stderrBytes,
            writeFailure,
            actualExit,
          });
          if (!closing) observe(null);
          try {
            await control.close();
            controlClosed = true;
            // ChildProcess close includes stdio closure. Keep this physical fact
            // separate from the native receipt and its final playback clock.
            if (
              spawned &&
              Number.isSafeInteger(child.pid) &&
              child.pid > 0 &&
              actualExit &&
              code === actualExit.code &&
              signal === actualExit.signal &&
              ((Number.isInteger(code) && code >= 0 && signal === null) ||
                (code === null &&
                  typeof signal === 'string' &&
                  signal.length > 0))
            )
              confirmTermination(true);
            else if (spawned) throw Error('host termination unconfirmed');
            const result = assertNativeDrain({
              owner,
              receipt,
              actualExit,
              spawned,
              pendingOutput: output,
              controlClosed,
              launchError: launchError || writeFailure,
              childPid: child.pid,
            });
            // The receipt validator also recognizes a proven pre-spawn failure.
            if (!result.processStarted) confirmTermination(false);
            close.resolve(result);
          } catch (error) {
            termination.reject(error);
            close.reject(error);
          }
        });
        child.stdout.on('data', (b) => {
          outputBytes += b.length;
          try {
            packets.write(b);
          } catch (e) {
            writeFailure = String(e);
            report('protocol-failure', { error: String(e) });
            observe(null);
          }
        });
        child.stderr.on('data', (b) => {
          const available = Math.max(0, 1024 * 1024 - stderrBytes);
          stderrBytes += b.length;
          if (available)
            report('host-stderr', {
              text: b.subarray(0, available).toString('utf8'),
            });
        });
        report('host-spawn', { pid: child.pid });
      } catch (e) {
        try {
          recurrence?.error();
        } catch {}
        launch.reject(e);
        if (!child) {
          try {
            if (control) await control.close();
            confirmTermination(false);
            close.resolve({
              generation: owner.generation,
              nativeDrained: true,
              processStarted: false,
              processExited: true,
              pipesClosed: true,
              stopped: null,
            });
          } catch (cleanup) {
            termination.reject(cleanup);
            close.reject(cleanup);
          }
        } else {
          writeFailure = String(e);
          void backendClose?.().catch(() => {});
        }
      }
    })();
    // Attach a handler immediately; rejection is still propagated to close callers.
    void close.promise.catch(() => {});
    void termination.promise.catch(() => {});
    void launch.promise.catch(() => {});
    backendClose = () => {
      if (!closing) {
        closing = true;
        report('host-close-request');
        void launch.promise
          .then(() => {
            if (child && !closed)
              return control.write('q\n').catch((e) => {
                report('close-write-error', { error: String(e) });
              });
          })
          .catch(() => {});
      }
      return close.promise;
    };
    return {
      write: async (value) => {
        await launch.promise;
        if (closing || closed) throw Error('host closing');
        try {
          await control.write(JSON.stringify(value) + '\n');
        } catch (error) {
          writeFailure = String(error);
          throw error;
        }
        report('issued', value);
      },
      close: backendClose,
    };
  };
  return {
    factory,
    cancel: () => {
      stopped = true;
      return backendClose ? backendClose() : Promise.resolve();
    },
    done: () => childDone,
    termination: () => terminationDone,
    pid: () => child?.pid,
  };
};
