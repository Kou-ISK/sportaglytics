import {
  MAX_PACKAGE_TIMELINE_CLIPS,
  MAX_PACKAGE_TIMELINE_SECONDS,
} from '../../../src/shared/media/packageMediaLimits';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  CaptureChunk,
  CaptureInput,
  CaptureInputStatus,
  CaptureSnapshot,
  CaptureStartRequest,
} from '../../../src/types/liveCapture';
import type { PackageMediaAngle } from '../../../src/types/package/media';
import { setPackageCaptureActive } from './captureRegistry';
import { CaptureProcess } from './captureProcess';
import { createCapturePackage, persistCapturePackage } from './capturePackage';

interface InputRuntime {
  source: CaptureInput;
  status: CaptureInputStatus;
  media: PackageMediaAngle;
  process?: CaptureProcess;
  baseTime: number;
  attempt: number;
  connectingAt: number;
}

export class CaptureSession {
  readonly id = randomUUID();
  private startedAt = performance.now();
  private readonly inputs: InputRuntime[];
  private phase: CaptureSnapshot['phase'] = 'recording';
  private message: string | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private pending: Promise<void> = Promise.resolve();
  private failed = false;
  private prepared = false;
  private stopPending: Promise<void> | undefined;
  private diskCheckAt = 0;

  constructor(
    readonly packagePath: string,
    private readonly request: CaptureStartRequest,
    private readonly ffmpeg: string,
    private readonly onState: (snapshot: CaptureSnapshot) => void,
  ) {
    this.inputs = request.inputs.map((source) => ({
      source,
      status: {
        id: source.id,
        name: source.name,
        kind: source.kind,
        phase: 'connecting',
        recordedSeconds: 0,
        segmentCount: 0,
      },
      media: {
        playbackFormat: 'fragmented-mp4',
        id: source.id,
        name: source.name,
        sourceKind: 'local',
        clips: [],
      },
      baseTime: 0,
      attempt: 0,
      connectingAt: 0,
    }));
  }

  get snapshot(): CaptureSnapshot {
    const ends = this.inputs.map((input) => {
      const last = input.media.clips[input.media.clips.length - 1];
      return last ? last.timelineStartSeconds + (last.durationSeconds ?? 0) : 0;
    });
    const recordingEnds = ends.filter(
      (_end, index) => this.inputs[index].status.phase === 'recording',
    );
    const liveEnd =
      this.phase === 'recording' && recordingEnds.length
        ? Math.min(...recordingEnds)
        : Math.max(0, ...ends);
    return {
      id: this.id,
      packagePath: this.packagePath,
      name: this.request.name,
      phase: this.phase,
      elapsedSeconds: (performance.now() - this.startedAt) / 1000,
      availableEndSeconds: liveEnd,
      inputs: this.inputs.map((input) => ({ ...input.status })),
      mediaAngles: this.inputs.map((input) => ({
        ...input.media,
        clips: [...input.media.clips],
      })),
      message: this.message,
    };
  }

  async start(): Promise<void> {
    try {
      await this.exclusive(async () => {
        if (this.phase !== 'recording')
          throw new Error('録画は取り消されました。');
        const disk = await fs.statfs(path.dirname(this.packagePath));
        if (disk.bavail * disk.bsize < 256 * 1024 * 1024)
          throw new Error('保存先の空き容量が不足しています。');
        if (this.phase !== 'recording')
          throw new Error('録画は取り消されました。');
        await createCapturePackage(this.packagePath);
        this.prepared = true;
        this.startedAt = performance.now();
        if (this.phase !== 'recording')
          throw new Error('録画は取り消されました。');
        setPackageCaptureActive(this.packagePath, true);
        for (const input of this.inputs) await this.startInput(input);
        if (this.phase !== 'recording')
          throw new Error('録画は取り消されました。');
        this.timer = setInterval(() => {
          if (this.polling || this.phase !== 'recording') return;
          this.polling = true;
          void this.exclusive(() => this.collect())
            .catch(() => {
              this.message =
                '録画の保存に失敗しました。保存先の接続と空き容量を確認してください。';
              this.failed = true;
              void this.stop();
            })
            .finally(() => {
              this.polling = false;
            });
        }, 500);
        this.onState(this.snapshot);
      });
    } catch (error) {
      this.failed = true;
      // Never finalize a path whose exclusive creation failed: it may be an existing document.
      if (this.prepared) await this.stop();
      throw error;
    }
  }
  private polling = false;

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.pending.then(operation);
    this.pending = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async startInput(input: InputRuntime): Promise<void> {
    const directory = path.join(
      this.packagePath,
      'media',
      input.source.id,
      `take-${input.attempt++}`,
    );
    await fs.mkdir(directory, { recursive: true });
    if (this.phase !== 'recording') throw new Error('録画は取り消されました。');
    input.connectingAt = performance.now();
    input.status.phase = 'connecting';
    input.status.message = undefined;
    input.process = new CaptureProcess(
      this.ffmpeg,
      directory,
      input.source,
      this.request.quality,
      (expected) => {
        input.status.phase = expected ? 'stopped' : 'disconnected';
        if (!expected)
          input.status.message =
            '入力が切断されました。接続先と機器を確認して再接続してください。';
        this.onState(this.snapshot);
      },
    );
  }

  private async collect(): Promise<void> {
    let changed = false;
    for (const input of this.inputs) {
      if (!input.process) continue;
      const segments = await input.process.collectSegments();
      for (const segment of segments) {
        const start = input.baseTime + segment.start;
        if (
          input.media.clips.length >= MAX_PACKAGE_TIMELINE_CLIPS ||
          start >= MAX_PACKAGE_TIMELINE_SECONDS
        ) {
          this.message =
            '録画の上限に達したため停止しました。続きは新しいパッケージへ録画してください。';
          void this.stop();
          break;
        }
        const duration = Math.min(
          segment.end - segment.start,
          MAX_PACKAGE_TIMELINE_SECONDS - start,
        );
        const previousIndex = input.media.clips.length - 1;
        const previous = input.media.clips[previousIndex];
        if (previous) {
          if (start <= previous.timelineStartSeconds)
            throw new Error('Non-monotonic capture timestamps');
          // Variable-rate packet ends can overlap or fall just short of the next
          // keyframe. Segments from one take share that boundary; separate takes
          // keep their reconnect gap. Never move a coding timestamp.
          const previousDuration = previous.durationSeconds ?? 0;
          const boundaryDuration = start - previous.timelineStartSeconds;
          const clippedDuration =
            path.dirname(previous.source) === input.process.directory
              ? boundaryDuration
              : Math.min(previousDuration, boundaryDuration);
          if (clippedDuration !== previousDuration) {
            input.media.clips[previousIndex] = {
              ...previous,
              durationSeconds: clippedDuration,
            };
            input.status.recordedSeconds -= previousDuration - clippedDuration;
          }
        }
        input.media.clips.push({
          id: `${input.source.id}-${input.attempt}-${segment.file.slice(8, 14)}`,
          sourceKind: 'local',
          source: path.join(input.process.directory, segment.file),
          timelineStartSeconds: start,
          durationSeconds: duration,
          gapBeforeSeconds: 0,
        });
        input.status.recordedSeconds += duration;
        input.status.segmentCount++;
        if (input.status.phase === 'connecting')
          input.status.phase = 'recording';
        changed = true;
      }
      if (
        this.phase === 'recording' &&
        input.status.phase === 'connecting' &&
        performance.now() - input.connectingAt > 30000
      ) {
        await input.process.stop();
        input.status.phase = 'disconnected';
        input.status.message =
          '映像が届かないため入力を停止しました。画質・機器・接続を確認して再接続してください。';
        changed = true;
      }
    }
    if (changed) {
      await persistCapturePackage(this.snapshot, this.request);
    }
    if (performance.now() > this.diskCheckAt) {
      this.diskCheckAt = performance.now() + 15000;
      const disk = await fs.statfs(this.packagePath);
      if (disk.bavail * disk.bsize < 256 * 1024 * 1024)
        throw new Error('Low disk space');
    }
    if (changed) this.onState(this.snapshot);
  }

  private input(id: string): InputRuntime {
    const input = this.inputs.find((candidate) => candidate.source.id === id);
    if (!input) throw new Error('録画入力が見つかりません。');
    return input;
  }

  async append(chunk: CaptureChunk): Promise<void> {
    if (this.phase !== 'recording') throw new Error('録画は終了しています。');
    const input = this.input(chunk.inputId);
    if (!input.process) throw new Error('入力の準備ができていません。');
    try {
      await input.process.append(chunk.sequence, chunk.data);
    } catch (error) {
      await input.process.stop();
      input.status.phase = 'disconnected';
      input.status.message =
        '録画データを保存できませんでした。画質または入力数を減らして再接続してください。';
      this.onState(this.snapshot);
      throw error;
    }
  }

  async endInput(inputId: string): Promise<void> {
    const input = this.input(inputId);
    await input.process?.stop();
    input.status.phase = 'disconnected';
    input.status.message =
      'カメラが停止しました。接続を確認して再接続してください。';
    this.onState(this.snapshot);
  }

  retry(inputId: string): Promise<void> {
    return this.exclusive(async () => {
      if (this.phase !== 'recording') throw new Error('録画は終了しています。');
      const input = this.input(inputId);
      if (!['disconnected', 'stopped'].includes(input.status.phase))
        throw new Error('この入力は既に接続されています。');
      await this.collect();
      if (this.phase !== 'recording') throw new Error('録画は終了しています。');
      const last = input.media.clips[input.media.clips.length - 1];
      input.baseTime = Math.max(
        (performance.now() - this.startedAt) / 1000,
        last ? last.timelineStartSeconds + (last.durationSeconds ?? 0) : 0,
      );
      await this.startInput(input);
      this.onState(this.snapshot);
    });
  }

  stop(): Promise<void> {
    if (!this.stopPending) {
      if (this.timer) clearInterval(this.timer);
      this.phase = 'stopping';
      this.onState(this.snapshot);
      this.stopPending = this.exclusive(() => this.finish());
    }
    return this.stopPending;
  }

  private async finish(): Promise<void> {
    if (!this.prepared) {
      this.phase = 'error';
      this.message = '録画は開始されませんでした。';
      this.onState(this.snapshot);
      return;
    }
    try {
      await Promise.all(this.inputs.map((input) => input.process?.stop()));
      await this.collect();
      if (!this.inputs.some((input) => input.media.clips.length)) {
        this.failed = true;
        this.message =
          '映像を保存できませんでした。入力機器と配信URLを確認して、新しい録画を開始してください。';
      }
      this.phase = this.failed ? 'error' : 'completed';
      await persistCapturePackage(this.snapshot, this.request);
    } catch {
      this.phase = 'error';
      this.message =
        '録画の終了処理に失敗しました。既に保存できた区間はパッケージに残っています。';
    } finally {
      setPackageCaptureActive(this.packagePath, false);
    }
    this.onState(this.snapshot);
  }
}
