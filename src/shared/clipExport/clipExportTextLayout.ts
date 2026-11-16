import type {
  ClipExportItem,
  ClipExportOverlaySettings,
} from './clipExportTypes';

export interface OverlayLine {
  text: string;
  isBold: boolean;
}
export interface ClipExportTextLayout {
  lines: OverlayLine[];
  fontRatio: number;
  lineRatio: number;
  boxRatio: number;
  paddingRatio: number;
  overflow: boolean;
}

export const formatOverlayLines = (
  clip: ClipExportItem,
  overlay: ClipExportOverlaySettings,
): OverlayLine[] => {
  if (!overlay.enabled) return [];
  const lines: OverlayLine[] = [];
  const title = [
    overlay.showActionIndex ? `#${clip.actionIndex ?? 1}` : '',
    overlay.showActionName ? clip.actionName : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (title) lines.push({ text: title, isBold: true });
  if (overlay.showLabels && clip.labels?.length)
    lines.push({
      text: clip.labels
        .map((label) =>
          label.group ? `${label.group}: ${label.name}` : label.name,
        )
        .join(', '),
      isBold: false,
    });
  if (overlay.showMemo && clip.memo?.trim())
    lines.push({ text: clip.memo, isBold: false });
  return lines;
};

export const CLIP_TEXT_HORIZONTAL_PADDING = 0.015;
// One pixel for the shadow plus one pixel for rasterization at the right edge.
export const CLIP_TEXT_EDGE_GUARD = 2;
export type MeasureClipText = (
  text: string,
  isBold: boolean,
  fontSize: number,
) => Promise<number>;

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });

const wrapParagraph = async (
  line: OverlayLine,
  capacity: number,
  fontSize: number,
  measure: MeasureClipText,
  maxLines: number,
): Promise<{ lines: OverlayLine[]; overflow: boolean }> => {
  const segments = Array.from(
    segmenter.segment(line.text),
    ({ segment }) => segment,
  );
  const result: OverlayLine[] = [];
  let start = 0;
  let overflow = false;
  do {
    const remaining = segments.slice(start).join('');
    if (result.length >= maxLines) {
      // Preserve the remainder for diagnostics, but stop measuring a paragraph
      // already proven too tall. Overflow layouts are never rendered.
      result.push({ ...line, text: remaining });
      return { lines: result, overflow: true };
    }
    if ((await measure(remaining, line.isBold, fontSize)) <= capacity) {
      result.push({ ...line, text: remaining });
      break;
    }
    // Measure whole candidates: summing character advances loses kerning/shaping.
    let low = 0;
    let high = segments.length - start;
    while (low + 1 < high) {
      const count = Math.floor((low + high) / 2);
      const width = await measure(
        segments.slice(start, start + count).join(''),
        line.isBold,
        fontSize,
      );
      if (width <= capacity) low = count;
      else high = count;
    }
    if (!low) {
      // A single indivisible grapheme is too wide; never silently crop it.
      overflow = true;
      low = 1;
    }
    // Keep ordinary English words together. Long unspaced tokens and Japanese
    // still wrap at grapheme boundaries, without deleting spaces or characters.
    const candidate = segments.slice(start, start + low);
    let lastSpace = -1;
    candidate.forEach((segment, index) => {
      if (/^[ \t]$/.test(segment)) lastSpace = index;
    });
    const next = segments[start + low];
    if (
      lastSpace > 0 &&
      next &&
      /^[A-Za-z0-9]$/.test(candidate[candidate.length - 1] ?? '') &&
      /^[A-Za-z0-9]$/.test(next)
    )
      low = lastSpace + 1;
    result.push({ ...line, text: segments.slice(start, start + low).join('') });
    start += low;
  } while (start < segments.length);
  return { lines: result, overflow };
};

/** Output-relative typography: 30px at 1080p, minimum 24px, total band <=20%. */
export const layoutClipExportText = async (
  input: OverlayLine[],
  size: { width: number; height: number },
  measure: MeasureClipText,
): Promise<ClipExportTextLayout> => {
  const { width, height } = size;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('映像のサイズを取得できません');
  const paddingRatio = 0.01;
  const capacity =
    width * (1 - 2 * CLIP_TEXT_HORIZONTAL_PADDING) - CLIP_TEXT_EDGE_GUARD;
  const paragraphs = input.flatMap((line) =>
    line.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((text) => ({ ...line, text })),
  );
  const atFont = async (font: number): Promise<ClipExportTextLayout> => {
    // Use exactly the same integer pixel size for measurement and rendering.
    const fontSize = Math.max(
      Math.ceil((height * 24) / 1080),
      Math.round((height * font) / 1080),
    );
    const fontRatio = fontSize / height;
    const lineRatio = fontRatio * 1.25;
    const maxLines = Math.floor((0.2 - paddingRatio * 2) / lineRatio);
    const wrapped =
      paragraphs.length > maxLines
        ? paragraphs.map((line) => ({ lines: [line], overflow: true }))
        : await Promise.all(
            paragraphs.map((line) =>
              wrapParagraph(line, capacity, fontSize, measure, maxLines),
            ),
          );
    const lines = wrapped.flatMap((paragraph) => paragraph.lines);
    const boxRatio = lines.length
      ? lines.length * lineRatio + paddingRatio * 2
      : 0;
    return {
      lines,
      fontRatio,
      lineRatio,
      paddingRatio,
      boxRatio: Math.min(0.2, boxRatio),
      overflow:
        wrapped.some((paragraph) => paragraph.overflow) || boxRatio > 0.2,
    };
  };
  const preferred = await atFont(30);
  if (!preferred.overflow) return preferred;
  // Reject impossible notes at the minimum before trying intermediate sizes.
  const minimum = await atFont(24);
  if (minimum.overflow) return minimum;
  for (let font = 29; font > 24; font--) {
    const layout = await atFont(font);
    if (!layout.overflow) return layout;
  }
  return minimum;
};

export const CLIP_TEXT_OVERFLOW_MESSAGE =
  'テキストが映像の高さ20%に収まりません。ノートを短くするか、書き出す情報のチェックを外してください。';
