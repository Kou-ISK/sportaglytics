import {
  CLIP_TEXT_HORIZONTAL_PADDING,
  CLIP_TEXT_OVERFLOW_MESSAGE,
} from '../../../src/shared/clipExport/clipExportTextLayout';
import { escapeFilterOption } from './ffmpegFilterEscaping';
import type { ClipExportTextLayout } from '../../../src/shared/clipExport/clipExportTextLayout';

interface BuildOverlayFiltersParams {
  layout: ClipExportTextLayout;
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  height: number;
}

export const buildOverlayFilters = ({
  layout,
  getJapaneseFontPath,
  escapeDrawtext,
  height,
}: BuildOverlayFiltersParams): string[] => {
  const { lines, fontRatio, lineRatio, boxRatio, paddingRatio, overflow } =
    layout;
  if (!lines.length) return [];
  if (overflow) throw new Error(CLIP_TEXT_OVERFLOW_MESSAGE);
  const filters = [
    `drawbox=x=0:y=ih-ih*${boxRatio}:w=iw:h=ih*${boxRatio}:color=black@0.7:t=fill`,
  ];
  lines.forEach((line, index) => {
    const fontPath = getJapaneseFontPath(line.isBold);
    const fontParam = `fontfile=${escapeFilterOption(fontPath.replace(/\\/g, '/'))}:`;
    const yRatio = 1 - boxRatio + paddingRatio + index * lineRatio;
    filters.push(
      `drawtext=${fontParam}text=${escapeDrawtext(line.text)}:expansion=none:fontcolor=white:fontsize=${Math.round(height * fontRatio)}:borderw=0:shadowcolor=black@0.55:shadowx=1:shadowy=1:x=w*${CLIP_TEXT_HORIZONTAL_PADDING}:y=h*${yRatio}`,
    );
  });
  return filters;
};
