export interface ExportFreezeFrame {
  time: number;
  duration: number;
  primary?: string | null;
  secondary?: string | null;
}

// Video insertions use presentation time, including preceding holds.
export const insertFreeze = (
  filters: string[],
  label: string,
  time: number,
  duration: number,
  prefix: string,
): string => {
  const output = `[${prefix}freeze]`;
  if (time === 0) {
    filters.push(`${label}tpad=start_mode=clone:start_duration=${duration}${output}`);
    return output;
  }
  filters.push(
    `${label}split[${prefix}pre][${prefix}post]`,
    `[${prefix}pre]trim=end=${time},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${duration}[${prefix}pad]`,
    `[${prefix}post]trim=start=${time},setpts=PTS-STARTPTS[${prefix}shift]`,
    `[${prefix}pad][${prefix}shift]concat=n=2:v=1:a=0${output}`,
  );
  return output;
};

/** Cut only on the original source clock. Never trim a previously delayed stream. */
export const insertAudioFreezes = (
  filters: string[],
  source: string,
  ordered: readonly ExportFreezeFrame[],
  clipDuration: number,
): string => {
  const parts: string[] = [];
  let cursor = 0;
  const appendMedia = (end: number): void => {
    if (end > cursor) parts.push(`atrim=start=${cursor}:end=${end},asetpts=PTS-STARTPTS`);
    cursor = end;
  };
  for (const frame of ordered) {
    if (frame.duration <= 0) continue;
    appendMedia(Math.max(0, Math.min(frame.time, clipDuration)));
    // A muted sample preserves the selected input's channel layout and sample rate.
    parts.push(`atrim=end_sample=1,asetpts=PTS-STARTPTS,volume=0,apad=pad_dur=${frame.duration},atrim=duration=${frame.duration}`);
  }
  if (!parts.length) return source;
  appendMedia(clipDuration);
  const input = (index: number): string => `[freezeAudioInput${index}]`;
  const output = (index: number): string => `[freezeAudioPart${index}]`;
  filters.push(`${source}asplit=${parts.length}${parts.map((_, index) => input(index)).join('')}`);
  for (const [index, part] of parts.entries()) filters.push(`${input(index)}${part}${output(index)}`);
  filters.push(`${parts.map((_, index) => output(index)).join('')}concat=n=${parts.length}:v=0:a=1[freezeAudio]`);
  return '[freezeAudio]';
};

export const overlayFreeze = (
  filters: string[],
  inputs: string[],
  label: string,
  image: string | null | undefined,
  inputIndex: number,
  time: number,
  duration: number,
  prefix: string,
): { label: string; inputIndex: number } => {
  if (!image) return { label, inputIndex };
  inputs.push('-i', image);
  filters.push(`[${inputIndex}:v]format=rgba[${prefix}raw]`);
  filters.push(
    `[${prefix}raw]${label}scale2ref[${prefix}scaled][${prefix}base]`,
  );
  filters.push(
    `[${prefix}base][${prefix}scaled]overlay=0:0:enable='between(t,${time},${time + duration})'[${prefix}out]`,
  );
  return { label: `[${prefix}out]`, inputIndex: inputIndex + 1 };
};
