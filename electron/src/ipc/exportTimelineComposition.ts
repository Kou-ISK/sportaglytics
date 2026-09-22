import { getFfmpegPath, H264_ENCODER_ARGS } from '../mediaTools';
import { probeMedia } from './packageMediaCompositionService';
import { runFfmpegProcess, concatFfmpegFiles } from './exportFfmpegProcess';
import { canConcatenateWithoutEncoding } from './exportStreamCopy';
import { buildExportTimelineSegments } from './exportTimelineRange';
import type {
  ExportTimelineClip,
  ExportTimeRange,
} from './exportTimelineRange';

export const composeExportTimelineRange = async (
  clips: ExportTimelineClip[],
  offset: number,
  range: ExportTimeRange,
  output: string,
  onProgress: (fraction: number) => void,
): Promise<void> => {
  const relevant = clips.filter((clip) => {
    const start = clip.timelineStartSeconds - offset;
    return (
      start < range.end &&
      (clip.durationSeconds === undefined ||
        start + clip.durationSeconds > range.start)
    );
  });
  // Preserve the angle's output dimensions, but do not probe every two-second
  // capture segment when exporting a short interval from a long recording.
  const sources = [
    ...new Set([
      ...(clips[0] ? [clips[0].sourcePath] : []),
      ...relevant.map((clip) => clip.sourcePath),
    ]),
  ];
  const probes = new Map<string, Awaited<ReturnType<typeof probeMedia>>>();
  for (let index = 0; index < sources.length; index += 4) {
    await Promise.all(
      sources.slice(index, index + 4).map(async (source) => {
        probes.set(source, await probeMedia(source));
      }),
    );
  }
  const first = probes.get(clips[0]?.sourcePath);
  if (!first) throw new Error('書き出し元の映像がありません');
  const width = Math.max(2, first.width - (first.width % 2));
  const height = Math.max(2, first.height - (first.height % 2));
  const segments = buildExportTimelineSegments(
    relevant.map((clip) => ({
      ...clip,
      // AAC padding can extend a file beyond its assigned package interval.
      // Never extend that interval into the next clip when probing the file.
      durationSeconds: Math.min(
        clip.durationSeconds ?? Infinity,
        probes.get(clip.sourcePath)?.durationSeconds ?? 0,
      ),
    })),
    offset,
    range,
  );
  const wholeSources: string[] = [];
  for (const segment of segments) {
    if (
      !segment.sourcePath ||
      segment.sourceStart !== 0 ||
      Math.abs(
        segment.duration -
          (probes.get(segment.sourcePath)?.durationSeconds ?? 0),
      ) > 0.001
    )
      break;
    wholeSources.push(segment.sourcePath);
  }
  if (
    wholeSources.length === segments.length &&
    (await canConcatenateWithoutEncoding(wholeSources))
  ) {
    await concatFfmpegFiles(getFfmpegPath, wholeSources, output, {
      durationSeconds: range.end - range.start,
      onProgress,
    });
    return;
  }
  const inputs: string[] = [];
  const filters: string[] = [];
  let input = 0;
  for (const [index, segment] of segments.entries()) {
    const duration = segment.duration;
    if (!segment.sourcePath) {
      filters.push(
        `color=c=black:s=${width}x${height}:r=30:d=${duration},setsar=1[v${index}]`,
      );
      filters.push(
        `anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[a${index}]`,
      );
      continue;
    }
    // Input seeking avoids decoding the match from its beginning for a late clip.
    inputs.push(
      '-ss',
      String(segment.sourceStart),
      '-t',
      String(duration),
      '-i',
      segment.sourcePath,
    );
    filters.push(
      `[${input}:v:0]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration}[v${index}]`,
    );
    filters.push(
      probes.get(segment.sourcePath)?.hasAudio
        ? `[${input}:a:0]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${duration}[a${index}]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[a${index}]`,
    );
    input++;
  }
  filters.push(
    `${segments.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`,
  );
  await runFfmpegProcess(
    getFfmpegPath,
    [
      '-n',
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-t',
      String(range.end - range.start),
      ...H264_ENCODER_ARGS,
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      output,
    ],
    { durationSeconds: range.end - range.start, onProgress },
  );
};
