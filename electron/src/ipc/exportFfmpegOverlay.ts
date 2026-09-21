import { escapeFilterOption } from './ffmpegFilterEscaping';
import type { OverlayLine } from './exportFfmpegRunners';

interface BuildOverlayFiltersParams {
  overlayLines: OverlayLine[];
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  variant: 'single' | 'dual';
}

const characterWidth = (character: string): number =>
  character.codePointAt(0)! > 0xff ? 2 : 1;

/** Keep explicit newlines and wrap wide Japanese text before placing each line. */
const wrapLines = (lines: OverlayLine[], limit: number): OverlayLine[] =>
  lines.flatMap((line) =>
    line.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .flatMap((paragraph) => {
        const wrapped: OverlayLine[] = [];
        let text = '';
        let width = 0;
        for (const character of paragraph) {
          const next = characterWidth(character);
          if (width + next > limit && text) {
            wrapped.push({ ...line, text });
            text = '';
            width = 0;
          }
          text += character;
          width += next;
        }
        wrapped.push({ ...line, text });
        return wrapped;
      }),
  );

export const buildOverlayFilters = ({
  overlayLines,
  getJapaneseFontPath,
  escapeDrawtext,
  variant,
}: BuildOverlayFiltersParams): string[] => {
  if (!overlayLines.length) return [];
  const lines = wrapLines(overlayLines, variant === 'single' ? 78 : 150);
  // Fit every line in at most half the picture instead of clipping a long note.
  const fontRatio = Math.min(0.033, 0.46 / (lines.length * 1.35));
  const lineRatio = fontRatio * 1.35;
  const boxRatio = Math.max(0.14, lines.length * lineRatio + 0.026);
  const maxWidth = Math.max(
    1,
    ...lines.map((line) =>
      Array.from(line.text).reduce(
        (width, character) => width + characterWidth(character),
        0,
      ),
    ),
  );
  const filters = [
    `drawbox=x=0:y=ih-ih*${boxRatio}:w=iw:h=ih*${boxRatio}:color=black@0.7:t=fill`,
  ];
  lines.forEach((line, index) => {
    let fontParam = '';
    try {
      const fontPath = getJapaneseFontPath(line.isBold);
      fontParam = `fontfile=${escapeFilterOption(fontPath.replace(/\\/g, '/'))}:`;
    } catch {
      /* FFmpeg may use its default font when no bundled font is available. */
    }
    const yRatio = 1 - boxRatio + 0.013 + index * lineRatio;
    filters.push(
      `drawtext=${fontParam}text='${escapeDrawtext(line.text)}':fontcolor=white:fontsize='min(h*${fontRatio},w*0.94/${maxWidth * 0.65})':borderw=0:shadowcolor=black@0.55:shadowx=1:shadowy=1:x=w*0.015:y=h*${yRatio}`,
    );
  });
  return filters;
};
