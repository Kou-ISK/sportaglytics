import { ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import { isExportClipsPayload } from './exportPayloadValidation';
import { isPlainObject } from './ipcPayloadGuards';
import { inspectExportText } from './exportTextInspection';
import {
  getClipExportSources,
  resolveExportSourceSelection,
} from './exportSourceSelection';
import {
  materializeExportSource,
  planExportSource,
} from './exportVirtualTimelineSource';
import { buildOverlayFilters } from './exportFfmpegOverlay';
import { formatOverlayLines } from '../../../src/shared/clipExport/clipExportTextLayout';
import { escapeDrawtext, getJapaneseFontPath } from './exportOptions';
import { runMediaProcess } from './mediaProcessRunner';
import type {
  ClipExportTextPreviewRequest,
  ClipExportTextPreviewResult,
} from '../../../src/shared/clipExport/clipExportTypes';

const isRequest = (value: unknown): value is ClipExportTextPreviewRequest =>
  isPlainObject(value) &&
  Array.isArray(value.exports) &&
  value.exports.length > 0 &&
  value.exports.length <= 4 &&
  value.exports.every(isExportClipsPayload) &&
  value.exports.reduce((sum, payload) => sum + payload.clips.length, 0) <=
    10000 &&
  typeof value.previewIndex === 'number' &&
  Number.isSafeInteger(value.previewIndex) &&
  value.previewIndex >= 0 &&
  value.previewIndex <
    value.exports.reduce((sum, payload) => sum + payload.clips.length, 0);

export const createExportTextPreview = async (
  request: ClipExportTextPreviewRequest,
  getFfmpegPath: () => string,
): Promise<ClipExportTextPreviewResult> => {
  const clips = await inspectExportText(request.exports);
  const selected = request.exports.flatMap((payload) =>
    payload.clips.map((clip) => ({ payload, clip })),
  )[request.previewIndex];
  const inspected = clips[request.previewIndex];
  if (!selected || !inspected) throw new Error('プレビュー対象がありません');
  const tempFiles: string[] = [];
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-text-preview-'),
  );
  try {
    const { payload, clip } = selected;
    const sources = getClipExportSources(
      clip,
      resolveExportSourceSelection(payload),
    );
    const args: string[] = ['-v', 'error', '-nostdin'];
    for (const source of sources) {
      const resolved = await materializeExportSource(
        await planExportSource(source),
        tempFiles,
        {
          start: clip.startTime,
          end: Math.min(clip.endTime, clip.startTime + 0.2),
        },
        () => undefined,
      );
      args.push(
        '-ss',
        String(clip.startTime - resolved.timeOrigin),
        '-i',
        resolved.sourcePath,
      );
    }
    const filters =
      sources.length > 1
        ? [
            "[0:v]scale=w='trunc(iw*sar/2)*2':h='trunc(ih/2)*2',setsar=1[m]",
            "[1:v][m]scale2ref=w='trunc(oh*mdar/2)*2':h=ih[s][r]",
            '[r][s]hstack=inputs=2[base]',
          ]
        : ['[0:v]null[base]'];
    const overlay = inspected.layout.overflow
      ? []
      : buildOverlayFilters({
          overlayLines: formatOverlayLines(clip, payload.overlay),
          variant: sources.length > 1 ? 'dual' : 'single',
          aspectRatio: inspected.width / inspected.height,
          getJapaneseFontPath,
          escapeDrawtext,
        });
    // Render text at output resolution, then scale the composite for the dialog.
    filters.push(
      `[base]scale=${inspected.width}:${inspected.height},setsar=1,${[...overlay, "scale=w='min(960,iw)':h=-2"].join(',')}[preview]`,
    );
    const file = path.join(directory, 'preview.png');
    await runMediaProcess(
      getFfmpegPath(),
      [
        ...args,
        '-filter_complex',
        filters.join(';'),
        '-map',
        '[preview]',
        '-frames:v',
        '1',
        '-threads',
        '1',
        file,
      ],
      { timeoutMs: 30000, maxOutputBytes: 65536 },
    );
    const image = `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
    return { clips, image };
  } finally {
    await Promise.all([
      ...tempFiles.map((file) => fs.rm(file, { force: true })),
      fs.rm(directory, { force: true, recursive: true }),
    ]);
  }
};

export const registerExportTextPreview = (
  getFfmpegPath: () => string,
): void => {
  ipcMain.handle(
    'clip-export:text-preview',
    async (event, request: unknown): Promise<ClipExportTextPreviewResult> => {
      if (!getValidatedEventSenderWindow(event) || !isRequest(request))
        return { clips: [], error: 'プレビュー対象を確認してください。' };
      try {
        return await createExportTextPreview(request, getFfmpegPath);
      } catch {
        return {
          clips: [],
          error:
            '映像を読み込めませんでした。接続・保存場所を確認して、再試行してください。',
        };
      }
    },
  );
};
