import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  CaptureInput,
  CaptureStartRequest,
} from '../../../src/types/liveCapture';
import { CAPTURE_MAX_QUEUED_BYTES } from '../../../src/shared/liveCapture/validation';
import {
  buildCaptureCommand,
  parseCompletedSegments,
  type CompletedCaptureSegment,
} from './captureCommand';

export class CaptureProcess {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly closed: Promise<void>;
  private stopping = false;
  private exited = false;
  private nextSequence = 0;
  private pendingBytes = 0;
  private published = new Set<string>();

  constructor(
    ffmpeg: string,
    readonly directory: string,
    readonly input: CaptureInput,
    quality: CaptureStartRequest['quality'],
    private readonly onExit: (expected: boolean) => void,
  ) {
    this.child = spawn(ffmpeg, buildCaptureCommand(input, quality), {
      cwd: directory,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // FFmpeg can echo credentials/URLs. Drain output without logging or publishing it.
    this.child.stdout.resume();
    this.child.stderr.resume();
    this.child.stdin.on('error', () => undefined);
    this.closed = new Promise((resolve) => {
      const finish = (): void => {
        if (this.exited) return;
        this.exited = true;
        // A closing renderer must not keep process shutdown waiting forever.
        try {
          this.onExit(this.stopping);
        } catch {
          /* The owner may have closed. */
        }
        resolve();
      };
      this.child.once('error', finish);
      this.child.once('close', finish);
    });
  }

  async append(sequence: number, data: Uint8Array): Promise<void> {
    if (
      this.input.kind !== 'device' ||
      this.stopping ||
      this.exited ||
      sequence !== this.nextSequence
    )
      throw new Error('録画データの順序または接続状態を確認してください。');
    if (this.pendingBytes + data.byteLength > CAPTURE_MAX_QUEUED_BYTES)
      throw new Error(
        '録画が保存速度に追いついていません。画質または入力数を減らしてください。',
      );
    this.nextSequence++;
    this.pendingBytes += data.byteLength;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('録画データの保存がタイムアウトしました。')),
          15000,
        );
        this.child.stdin.write(data, (error) => {
          clearTimeout(timer);
          if (error) reject(new Error('映像の取り込みが切断されました。'));
          else resolve();
        });
      });
    } finally {
      this.pendingBytes -= data.byteLength;
    }
  }

  async collectSegments(): Promise<CompletedCaptureSegment[]> {
    const filename = path.join(this.directory, 'segments.csv');
    let csv: string;
    try {
      const stat = await fs.stat(filename);
      if (stat.size > 4 * 1024 * 1024)
        throw new Error('録画区間の上限に達しました。');
      csv = await fs.readFile(filename, 'utf8');
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return [];
      throw error;
    }
    const completed = parseCompletedSegments(csv).filter(
      (segment) => !this.published.has(segment.file),
    );
    for (const segment of completed) this.published.add(segment.file);
    return completed;
  }

  async stop(): Promise<void> {
    if (this.exited) return;
    this.stopping = true;
    if (this.input.kind === 'device') this.child.stdin.end();
    else this.child.stdin.write('q\n');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        this.child.kill('SIGKILL');
        reject(
          new Error(
            '録画処理の終了がタイムアウトしました。保存済み区間を確認してください。',
          ),
        );
      }, 10000);
    });
    try {
      await Promise.race([this.closed, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}
