import {
  layoutClipExportText,
  CLIP_TEXT_OVERFLOW_MESSAGE,
} from '../../../src/shared/clipExport/clipExportTextLayout';
import { escapeFilterOption } from './ffmpegFilterEscaping';
import type { OverlayLine } from './exportFfmpegRunners';

interface BuildOverlayFiltersParams {
  overlayLines: OverlayLine[];
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  variant: 'single' | 'dual';
  aspectRatio?: number;
}

export const buildOverlayFilters = ({
  overlayLines,
  getJapaneseFontPath,
  escapeDrawtext,
  variant,
  aspectRatio,
}: BuildOverlayFiltersParams): string[] => {
  if (!overlayLines.length) return [];
  const { lines, fontRatio, lineRatio, boxRatio, paddingRatio, overflow } =
    layoutClipExportText(
      overlayLines,
      aspectRatio ?? (variant === 'single' ? 16 / 9 : 32 / 9),
    );
  if (overflow) throw new Error(CLIP_TEXT_OVERFLOW_MESSAGE);
  const filters = [
    `drawbox=x=0:y=ih-ih*${boxRatio}:w=iw:h=ih*${boxRatio}:color=black@0.7:t=fill`,
  ];
  lines.forEach((line, index) => {
    const fontPath = getJapaneseFontPath(line.isBold);
    const fontParam = `fontfile=${escapeFilterOption(fontPath.replace(/\\/g, '/'))}:`;
    const yRatio = 1 - boxRatio + paddingRatio + index * lineRatio;
    filters.push(
      `drawtext=${fontParam}text='${escapeDrawtext(line.text)}':fontcolor=white:fontsize='h*${fontRatio}':borderw=0:shadowcolor=black@0.55:shadowx=1:shadowy=1:x=w*0.015:y=h*${yRatio}`,
    );
  });
  return filters;
};
