import type { OverlayLine } from './exportFfmpegRunners';

interface OverlayLineConfig {
  color: string;
  size: number | string;
  y: string;
}

interface BuildOverlayFiltersParams {
  overlayLines: OverlayLine[];
  getJapaneseFontPath: (isBold?: boolean) => string;
  escapeDrawtext: (text: string) => string;
  variant: 'single' | 'dual';
}

const SINGLE_ANGLE_BOX_HEIGHT_EXPR = 'ih*0.14';
const SINGLE_ANGLE_TEXT_BOX_HEIGHT_EXPR = 'main_h*0.14';

const formatExprValue = (value: number | string): string => {
  return typeof value === 'number' ? String(value) : `(${value})`;
};

const buildBoxHeight = (
  overlayLines: OverlayLine[],
  variant: 'single' | 'dual',
): number | string => {
  if (variant === 'single') {
    return SINGLE_ANGLE_BOX_HEIGHT_EXPR;
  }

  const totalDisplayLines = overlayLines.reduce((acc, line) => {
    const lineCount = (line.text.match(/\n/g) || []).length + 1;
    return acc + lineCount;
  }, 0);
  return Math.max(60, 60 + (totalDisplayLines - 1) * 35);
};

const buildLineConfigs = (
  boxHeight: number | string,
  variant: 'single' | 'dual',
): OverlayLineConfig[] => {
  if (variant === 'single') {
    const boxHeightExpr = formatExprValue(SINGLE_ANGLE_TEXT_BOX_HEIGHT_EXPR);
    return [
      {
        color: 'white',
        size: 'h*0.04',
        y: `main_h-${boxHeightExpr}+main_h*0.013`,
      },
      {
        color: '#dcdcdc',
        size: 'h*0.033',
        y: `main_h-${boxHeightExpr}+main_h*0.059`,
      },
      {
        color: '#bbbbbb',
        size: 'h*0.029',
        y: `main_h-${boxHeightExpr}+main_h*0.104`,
      },
    ];
  }

  const dualBoxHeight =
    typeof boxHeight === 'number' ? boxHeight : Number.parseFloat(boxHeight);

  return [
    {
      color: 'white',
      size: 34,
      y: `h-${dualBoxHeight - 25}`,
    },
    {
      color: '#dcdcdc',
      size: 28,
      y: `h-${Math.max(30, dualBoxHeight - 60)}`,
    },
    {
      color: '#bbbbbb',
      size: 24,
      y: `h-${Math.max(30, dualBoxHeight - 90)}`,
    },
  ];
};

export const buildOverlayFilters = ({
  overlayLines,
  getJapaneseFontPath,
  escapeDrawtext,
  variant,
}: BuildOverlayFiltersParams): string[] => {
  const boxHeight = buildBoxHeight(overlayLines, variant);
  const boxHeightExpr = formatExprValue(boxHeight);
  const filters: string[] = [
    `drawbox=x=0:y=ih-${boxHeightExpr}:w=iw:h=${boxHeightExpr}:color=black@0.7:t=fill`,
  ];
  const lineConfigs = buildLineConfigs(boxHeight, variant);

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
        ? 'borderw=0:shadowcolor=black@0.55:shadowx=1:shadowy=1'
        : 'borderw=0:bordercolor=black@0.0';
    filters.push(
      `drawtext=${fontParam}text='${safeText}':fontcolor=${config.color}:fontsize=${config.size}:${style}:x=20:y=${config.y}`,
    );
  });

  return filters;
};
