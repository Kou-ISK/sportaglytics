'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const WIRE_BYTES = 217472,
  MAIN_SLOTS = 704,
  ROW_BYTES = 64,
  HEADER_BYTES = 256;
const FILE_BYTES = HEADER_BYTES + MAIN_SLOTS * ROW_BYTES + WIRE_BYTES + 64;
const MAGIC = 0x53504c5952454331n,
  FOOTER = 0x53504c59454e4431n;
// Explicit backing storage including native rings/snapshot, stream reserve and
// VM bookkeeping allowance. This is not a bound on Electron's entire heap/RSS.
const BUFFER_BUDGET =
  262144 + 32768 + WIRE_BYTES + 262144 + 65536 + 65536 + HEADER_BYTES + 64;
const PHASES = Object.freeze({
  preparing: 1,
  paused: 2,
  playing: 3,
  seeking: 4,
  starved: 5,
  failed: 6,
  closing: 7,
  closed: 8,
});
const KINDS = Object.freeze({
  'surface-demand': 100,
  'surface-notice': 101,
  'surface-transfer': 102,
  'surface-draw-ack': 103,
  'surface-released': 104,
  'surface-stale-before-transfer': 105,
  'stale-draw-rejected': 106,
  issued: 110,
  observation: 111,
  'host-spawn': 112,
  'host-exit': 113,
  'host-close': 114,
  'integration-failure': 120,
  'surface-failure': 121,
  'protocol-failure': 122,
  'initialization-failed': 123,
});
const finite = (n) =>
  typeof n === 'number' &&
  Number.isFinite(n) &&
  Math.abs(n) <= Number.MAX_SAFE_INTEGER
    ? n
    : 0;
function validNative(wire, host) {
  try {
    if (
      wire.readBigUInt64LE(0) !== MAGIC ||
      wire.readBigUInt64LE(8) !== 1n ||
      wire.readBigUInt64LE(16) !== BigInt(host) ||
      ![1n, 2n].includes(wire.readBigUInt64LE(24)) ||
      wire.readBigUInt64LE(32) !== 3392n ||
      wire.readBigUInt64LE(40) !== BigInt(WIRE_BYTES)
    )
      return false;
    let offset = 64;
    for (const [group, capacity] of [2048, 1024, 256, 64].entries()) {
      const count = wire.readBigUInt64LE(offset + 16),
        kept = count < BigInt(capacity) ? count : BigInt(capacity);
      if (
        wire.readBigUInt64LE(offset) !== BigInt(group) ||
        wire.readBigUInt64LE(offset + 8) !== BigInt(capacity) ||
        wire.readBigUInt64LE(offset + 24) !== kept ||
        wire.readBigUInt64LE(offset + 32) !== (kept ? count - kept + 1n : 0n) ||
        wire.readBigUInt64LE(offset + 40) !== count ||
        wire.readBigUInt64LE(offset + 48) !== count - kept
      )
        return false;
      offset += 64 + capacity * 64;
    }
    return (
      wire.readBigUInt64LE(offset) === FOOTER &&
      wire.readBigUInt64LE(offset + 8) === 1n &&
      wire.readBigUInt64LE(offset + 16) === BigInt(host) &&
      wire.readBigUInt64LE(offset + 24) === wire.readBigUInt64LE(24)
    );
  } catch {
    return false;
  }
}
function createRecorder(directory, dependencies = {}) {
  const io = dependencies.io || fsp;
  let rows, wire, header, trailer, launchID;
  try {
    launchID = randomInt(2 ** 48 - 1);
    rows = new Float64Array(MAIN_SLOTS * 8);
    wire = Buffer.alloc(WIRE_BYTES);
    header = Buffer.alloc(HEADER_BYTES);
    trailer = Buffer.alloc(64);
  } catch {
    return null;
  }
  const counts = [0, 0],
    origin = performance.now();
  let nextHost = 0,
    active = null,
    frozen = false,
    saving = false,
    status = 0,
    lastResource = -Infinity,
    savePromise = Promise.resolve();
  const put = (group, event, host, generation, seek, pts, value) => {
    if (frozen) return;
    const cap = group ? 64 : 640,
      base = group ? 640 : 0,
      n = counts[group]++,
      offset = (base + (n % cap)) * 8;
    rows[offset] = n + 1;
    rows[offset + 1] = (performance.now() - origin) * 1e6;
    rows[offset + 2] = event;
    rows[offset + 3] = host;
    rows[offset + 4] = finite(generation);
    rows[offset + 5] = finite(seek);
    rows[offset + 6] = finite(pts);
    rows[offset + 7] = finite(value);
  };
  const persist = async (host, reason, received, complete, transport) => {
    let file;
    try {
      await io.mkdir(directory, { recursive: true, mode: 0o700 });
      if (!(await io.lstat(directory)).isDirectory())
        throw Error('diagnostic directory is not owned directory');
      // Exactly four exclusive slots. Partial files occupy their slot forever.
      for (let i = 1; i <= 4; i++)
        try {
          file = await io.open(
            path.join(directory, 'recurrence-' + i + '.bin'),
            fs.constants.O_WRONLY |
              fs.constants.O_CREAT |
              fs.constants.O_EXCL |
              fs.constants.O_NOFOLLOW,
            0o600,
          );
          break;
        } catch (e) {
          if (e.code !== 'EEXIST') throw e;
        }
      if (!file) {
        status = 3;
        return;
      }
      const values = [
        149001,
        1,
        FILE_BYTES,
        host,
        reason,
        complete ? 1 : 0,
        received,
        transport,
        counts[0],
        counts[1],
        640,
        64,
        WIRE_BYTES,
        BUFFER_BUDGET,
        launchID,
      ];
      values.forEach((n, i) => header.writeDoubleLE(n, i * 8));
      trailer.writeDoubleLE(149002, 0);
      trailer.writeDoubleLE(FILE_BYTES, 8);
      let written = 0;
      // No concatenation or object graph/string serialization. At most 64KiB
      // submitted to a single write at once, and no concurrent saves/reopen buffers.
      for (const buffer of [header, Buffer.from(rows.buffer), wire, trailer]) {
        let offset = 0;
        while (offset < buffer.length) {
          const length = Math.min(65536, buffer.length - offset);
          if (written + length > 2 * 1024 * 1024)
            throw Error('diagnostic file cap');
          const result = await file.write(buffer, offset, length, null);
          if (!result.bytesWritten) throw Error('diagnostic short write');
          offset += result.bytesWritten;
          written += result.bytesWritten;
        }
      }
      await file.close();
      file = null;
      status = complete ? 1 : 2;
    } catch {
      status = 4;
    } finally {
      if (file)
        try {
          await file.close();
        } catch {}
      saving = false;
      try {
        dependencies.onStatus?.(status);
      } catch {}
    }
  };
  const freeze = (host, reason, received, complete, transport) => {
    if (saving || status) return;
    frozen = true;
    saving = true;
    // Diagnostic I/O is never joined by playback close/drain. Tests/reader may
    // await done explicitly. Immediate process exit can leave a partial file.
    savePromise = Promise.resolve()
      .then(() => persist(host, reason, received, complete, transport))
      .catch(() => {
        saving = false;
        status = 4;
      });
  };
  const api = {
    beginHost() {
      try {
        if (active || frozen) return null;
        wire.fill(0);
        const host = ++nextHost;
        let received = 0,
          ended = false,
          reason = 0,
          invalid = false,
          failureTimer;
        const finish = (transport) => {
          if (ended) return;
          ended = true;
          clearTimeout(failureTimer);
          active = null;
          if (received || reason || invalid) {
            let complete = false;
            try {
              complete =
                !invalid && received === WIRE_BYTES && validNative(wire, host);
              if (complete) reason = Number(wire.readBigUInt64LE(24));
            } catch {
              complete = false;
            }
            freeze(host, reason || 3, received, complete, transport);
          }
        };
        const session = {
          host,
          rendererFailure(value) {
            try {
              // Retain the final clean host only until another host owns these buffers.
              if (frozen || host !== nextHost || (active && active !== session))
                return;
              const keys = [
                'stage',
                'code',
                'sequence',
                'seekId',
                'targetTime',
                'confirmedTime',
              ];
              if (
                !value ||
                Object.keys(value).some(
                  (k) => !keys.includes(k) && k !== 'recovery',
                ) ||
                !keys.every(
                  (k) =>
                    typeof value[k] === 'number' && Number.isFinite(value[k]),
                )
              )
                return;
              const recovery = value.recovery;
              if (recovery !== undefined) {
                const contextKeys = [
                  'requestedTime',
                  'duration',
                  'durationKind',
                  'readyState',
                  'seeking',
                ];
                if (
                  !recovery ||
                  Object.keys(recovery).length !== contextKeys.length ||
                  !contextKeys.every(
                    (k) =>
                      typeof recovery[k] === 'number' &&
                      Number.isFinite(recovery[k]),
                  )
                )
                  return;
                if (
                  recovery.requestedTime < 0 ||
                  recovery.requestedTime > 86400 ||
                  Math.abs(recovery.duration) > 86400 ||
                  !Number.isInteger(recovery.durationKind) ||
                  recovery.durationKind < 0 ||
                  recovery.durationKind > 4 ||
                  (recovery.durationKind !== 0 && recovery.duration !== 0) ||
                  !Number.isInteger(recovery.readyState) ||
                  recovery.readyState < 0 ||
                  recovery.readyState > 5 ||
                  ![0, 1].includes(recovery.seeking)
                )
                  return;
              }
              if (
                ![1, 2].includes(value.stage) ||
                !Number.isInteger(value.code) ||
                value.code < 0 ||
                value.code > 36 ||
                !['sequence', 'seekId'].every(
                  (k) => Number.isSafeInteger(value[k]) && value[k] >= 1,
                ) ||
                !['targetTime', 'confirmedTime'].every(
                  (k) => value[k] >= 0 && value[k] <= 86400,
                )
              )
                return;
              put(
                0,
                126,
                host,
                value.sequence,
                value.seekId,
                value.targetTime * 120000,
                value.stage * 256 + value.code,
              );
              put(
                0,
                127,
                host,
                value.sequence,
                value.seekId,
                value.confirmedTime * 120000,
                recovery ? recovery.requestedTime * 120000 : 0,
              );
              // Optional duration context uses one existing fixed-ring slot. Event 128
              // means row 127's spare value is the failed snapshot's requested ticks.
              if (recovery)
                put(
                  0,
                  128,
                  host,
                  value.sequence,
                  value.seekId,
                  recovery.duration * 120000,
                  recovery.durationKind +
                    recovery.readyState * 8 +
                    recovery.seeking * 64,
                );
              reason = 126;
              if (ended) freeze(host, reason, received, false, 6);
              else {
                frozen = true;
                failureTimer = setTimeout(() => finish(5), 250);
                failureTimer.unref();
              }
            } catch {}
          },
          surfaceStage(event, id) {
            try {
              if (!ended && (event === 108 || event === 109))
                put(0, event, host, 0, 0, 0, id);
            } catch {}
          },
          note(kind, value = {}) {
            try {
              let event = KINDS[kind];
              if (!event || ended) return;
              if (kind === 'surface-draw-ack' && value.drawn !== true)
                event = 107;
              if (kind === 'issued') {
                put(
                  0,
                  event,
                  host,
                  value.sequence,
                  value.seekId,
                  finite(value.targetTime) * 120000,
                  value.rate,
                );
                put(
                  0,
                  115,
                  host,
                  value.sequence,
                  value.seekId,
                  value.volume,
                  (value.playing === true ? 1 : 0) +
                    (value.muted === true ? 2 : 0) +
                    finite(value.audioTrack) * 16,
                );
              } else if (kind === 'observation') {
                put(
                  0,
                  event,
                  host,
                  value.sequence,
                  value.seekId,
                  finite(value.time) * 120000,
                  (PHASES[value.phase] || 0) +
                    (value.videoReady === true ? 256 : 0) +
                    (value.audioReady === true ? 512 : 0),
                );
              } else
                put(
                  0,
                  event,
                  host,
                  value.nativeGeneration || value.generation,
                  value.seekId,
                  value.pts,
                  value.id ?? value.code ?? 0,
                );
              const now = performance.now();
              if (now - lastResource >= 1000 && !frozen) {
                lastResource = now;
                const u = process.resourceUsage();
                put(1, 180, host, 0, 0, u.userCPUTime, u.systemCPUTime);
                put(1, 181, host, 0, 0, u.maxRSS, u.minorPageFault);
              }
              if (
                ((event >= 120 && event <= 123) ||
                  (kind === 'observation' &&
                    (value.phase === 'starved' || value.phase === 'failed'))) &&
                !frozen
              ) {
                reason = event === 111 ? 124 : event;
                frozen = true;
                failureTimer = setTimeout(() => finish(5), 250);
                failureTimer.unref();
              }
            } catch {
              /* Diagnostic errors never reach the required playback reporter. */
            }
          },
          data(bytes) {
            try {
              if (ended || invalid) return false;
              if (!frozen) {
                frozen = true;
                failureTimer = setTimeout(() => finish(5), 250);
                failureTimer.unref();
              }
              if (
                !Buffer.isBuffer(bytes) ||
                bytes.length > WIRE_BYTES - received
              ) {
                invalid = true;
                finish(4);
                return false;
              }
              bytes.copy(wire, received);
              received += bytes.length;
              if (received === WIRE_BYTES) finish(1);
              return !ended;
            } catch {
              invalid = true;
              finish(4);
              return false;
            }
          },
          end() {
            try {
              if (received || reason || invalid) finish(2);
            } catch {}
          },
          exit(code = 0, signal = null) {
            try {
              if (!ended && (code !== 0 || signal !== null)) {
                put(
                  0,
                  113,
                  host,
                  0,
                  0,
                  0,
                  typeof code === 'number' ? code : -1,
                );
                reason = reason || 125;
              }
              finish(3);
            } catch {}
          },
          error() {
            try {
              invalid = true;
              finish(4);
            } catch {}
          },
        };
        active = session;
        return session;
      } catch {
        return null;
      }
    },
    state() {
      return {
        status,
        saving,
        frozen,
        hosts: nextHost,
        mainCounts: [...counts],
        bufferBudget: BUFFER_BUDGET,
        fileBytes: FILE_BYTES,
      };
    },
    done() {
      return savePromise;
    },
  };
  return api;
}
module.exports = {
  createRecorder,
  WIRE_BYTES,
  MAIN_SLOTS,
  FILE_BYTES,
  BUFFER_BUDGET,
  MAGIC,
  FOOTER,
  KINDS,
  validNative,
};
