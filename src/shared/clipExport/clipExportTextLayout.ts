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

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
// Conservative glyph widths avoid splitting Japanese, emoji or combining marks.
const widthInEm = (text: string): number =>
  /^[\x20-\x7e]$/.test(text) ? (/[MW@]/.test(text) ? 1 : 0.7) : 1.2;
const wrap = (lines: OverlayLine[], capacity: number): OverlayLine[] =>
  lines.flatMap((line) =>
    line.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .flatMap((paragraph) => {
        const result: OverlayLine[] = [];
        let text = '';
        let width = 0;
        for (const { segment } of segmenter.segment(paragraph)) {
          const next = widthInEm(segment);
          if (text && width + next > capacity) {
            result.push({ ...line, text });
            text = '';
            width = 0;
          }
          text += segment;
          width += next;
        }
        result.push({ ...line, text });
        return result;
      }),
  );

/** Output-relative typography: 30px at 1080p, minimum 24px, total band <=20%. */
export const layoutClipExportText = (
  input: OverlayLine[],
  aspectRatio: number,
): ClipExportTextLayout => {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0)
    throw new Error('映像のサイズを取得できません');
  const paddingRatio = 0.01;
  for (let font = 30; font >= 24; font--) {
    const fontRatio = font / 1080;
    const lines = wrap(input, (aspectRatio * 0.94) / fontRatio);
    const lineRatio = fontRatio * 1.25;
    const boxRatio = lines.length
      ? lines.length * lineRatio + paddingRatio * 2
      : 0;
    if (boxRatio <= 0.2 || font === 24)
      return {
        lines,
        fontRatio,
        lineRatio,
        paddingRatio,
        boxRatio: Math.min(0.2, boxRatio),
        overflow: boxRatio > 0.2,
      };
  }
  throw new Error('テキスト配置を計算できません');
};

export const CLIP_TEXT_OVERFLOW_MESSAGE =
  'テキストが映像の高さ20%に収まりません。ノートを短くするか、書き出す情報のチェックを外してください。';
