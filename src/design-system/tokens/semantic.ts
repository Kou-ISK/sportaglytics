import { primitiveColors } from './primitive';

export type DesignSystemMode = 'dark' | 'light';

export interface SemanticTokens {
  media: {
    surface: string;
    foreground: string;
    muted: string;
    hover: string;
    disabled: string;
    accent: string;
  };
  surface: {
    canvas: string;
    work: string;
    raised: string;
    overlay: string;
    selected: string;
    hover: string;
  };
  content: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  interactive: {
    primary: string;
    hover: string;
    pressed: string;
    selected: string;
    disabled: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  data: {
    pitchSurface: string;
    pitchLine: string;
    team1: string;
    team2: string;
    positive: string;
    negative: string;
  };
}

const rgba = (hex: string, opacity: number): string => {
  const normalized = hex.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
};

export const createSemanticTokens = (
  mode: DesignSystemMode,
): SemanticTokens => {
  const dark = mode === 'dark';
  const primary = dark
    ? primitiveColors.signalBlue
    : primitiveColors.signalBlueLight;
  const contentPrimary = dark ? primitiveColors.textCool : primitiveColors.ink;
  const contentSecondary = dark
    ? primitiveColors.textMuted
    : primitiveColors.neutral600;
  const contentDisabled = dark
    ? rgba(primitiveColors.white, 0.5)
    : rgba(primitiveColors.black, 0.38);
  const borderSubtle = dark
    ? rgba(primitiveColors.white, 0.12)
    : rgba(primitiveColors.black, 0.12);
  const borderStrong = dark
    ? rgba(primitiveColors.white, 0.24)
    : rgba(primitiveColors.black, 0.24);
  const hover = dark
    ? rgba(primitiveColors.white, 0.08)
    : rgba(primitiveColors.black, 0.05);
  const selected = dark ? rgba(primary, 0.16) : rgba(primary, 0.12);

  return {
    media: {
      surface: primitiveColors.black,
      foreground: primitiveColors.textCool,
      muted: primitiveColors.neutral400,
      hover: primitiveColors.charcoalRaised,
      disabled: primitiveColors.neutral600,
      accent: primitiveColors.signalBlue,
    },
    surface: {
      canvas: dark ? primitiveColors.nearBlack : primitiveColors.neutral100,
      work: dark ? primitiveColors.charcoal : primitiveColors.white,
      raised: dark ? primitiveColors.charcoalRaised : primitiveColors.neutral50,
      overlay: dark
        ? rgba(primitiveColors.black, 0.82)
        : rgba(primitiveColors.white, 0.96),
      selected,
      hover,
    },
    content: {
      primary: contentPrimary,
      secondary: contentSecondary,
      disabled: contentDisabled,
      inverse: dark ? primitiveColors.black : primitiveColors.white,
    },
    border: {
      subtle: borderSubtle,
      strong: borderStrong,
      focus: primary,
    },
    interactive: {
      primary,
      hover: dark ? rgba(primary, 0.22) : rgba(primary, 0.14),
      pressed: dark ? rgba(primary, 0.32) : rgba(primary, 0.22),
      selected,
      disabled: contentDisabled,
    },
    status: {
      success: primitiveColors.success,
      warning: primitiveColors.warning,
      error: primitiveColors.error,
      info: primitiveColors.info,
    },
    data: {
      pitchSurface: primitiveColors.pitchGreen,
      pitchLine: primitiveColors.textCool,
      team1: primitiveColors.neonBlue,
      team2: primitiveColors.warmCoral,
      positive: primitiveColors.success,
      negative: primitiveColors.error,
    },
  };
};
