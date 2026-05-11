import type { OverlayLine } from './exportFfmpegRunners';

interface OverlayLineConfig {
  color: string;
  size: number;
  y: string;
}

interface BuildOverlayFiltersParams {
  overlayLines: OverlayLine[];
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  variant: 'single' | 'dual';
}

const buildBoxHeight = (overlayLines: OverlayLine[]): number => {
  const totalDisplayLines = overlayLines.reduce((acc, line) => {
    const lineCount = (line.text.match(/\n/g) || []).length + 1;
    return acc + lineCount;
  }, 0);
  return Math.max(60, 60 + (totalDisplayLines - 1) * 35);
};

const buildLineConfigs = (boxHeight: number): OverlayLineConfig[] => {
  return [
    {
      color: 'white',
      size: 34,
      y: `h-${boxHeight - 25}`,
    },
    {
      color: '#dcdcdc',
      size: 28,
      y: `h-${Math.max(30, boxHeight - 60)}`,
    },
    {
      color: '#bbbbbb',
      size: 24,
      y: `h-${Math.max(30, boxHeight - 90)}`,
    },
  ];
};

export const buildOverlayFilters = ({
  overlayLines,
  getJapaneseFontPath,
  escapeDrawtext,
  variant,
}: BuildOverlayFiltersParams): string[] => {
  const boxHeight = buildBoxHeight(overlayLines);
  const filters: string[] = [
    `drawbox=x=0:y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@0.7:t=fill`,
  ];
  const lineConfigs = buildLineConfigs(boxHeight);

  overlayLines.forEach((line, idx) => {
    const safeText = escapeDrawtext(line.text);
    const config = lineConfigs[idx] ?? lineConfigs[lineConfigs.length - 1];

    let fontParam = '';
    try {
      const fontPath = getJapaneseFontPath(line.isBold);
      fontParam = `fontfile='${fontPath}':`;
    } catch {
      fontParam = '';
    }

    const style =
      variant === 'single'
        ? 'borderw=0:shadowcolor=black@0.55:shadowx=2:shadowy=2'
        : 'borderw=0:bordercolor=black@0.0';
    filters.push(
      `drawtext=${fontParam}text='${safeText}':fontcolor=${config.color}:fontsize=${config.size}:${style}:x=20:y=${config.y}`,
    );
  });

  return filters;
};
