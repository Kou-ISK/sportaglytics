import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';
import type { SxProps } from '@mui/system';

// ========================================
// 型拡張: カスタムパレット＋セマンティックトークン
// ========================================
declare module '@mui/material/styles' {
  interface Palette {
    team1: Palette['primary'];
    team2: Palette['primary'];
    momentum: {
      try: string;
      positive: string;
      negative: string;
      neutral: string;
    };
  }
  interface PaletteOptions {
    team1?: PaletteOptions['primary'];
    team2?: PaletteOptions['primary'];
    momentum?: {
      try?: string;
      positive?: string;
      negative?: string;
      neutral?: string;
    };
  }

  interface Theme {
    custom: {
      controllerButton: SxProps<Theme>;
      controllerPresetButton: SxProps<Theme>;
      // ===== 新規追加: セマンティックトークン =====
      rails: {
        timelineBg: string;
        laneBg: string;
      };
      bars: {
        team1: string;
        team2: string;
        selectedBorder: string;
      };
      glass: {
        panel: string;
        hover: string;
        hoverStrong: string;
      };
      accents: {
        hoverPink: string;
      };
    };
  }
  interface ThemeOptions {
    custom?: {
      controllerButton?: SxProps<Theme>;
      controllerPresetButton?: SxProps<Theme>;
      rails?: {
        timelineBg?: string;
        laneBg?: string;
      };
      bars?: {
        team1?: string;
        team2?: string;
        selectedBorder?: string;
      };
      glass?: {
        panel?: string;
        hover?: string;
        hoverStrong?: string;
      };
      accents?: {
        hoverPink?: string;
      };
    };
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    team1: true;
    team2: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    team1: true;
    team2: true;
  }
}

// ========================================
// カラースキーム定義: Neon (一元化)
// ========================================
const NEON_SCHEME = {
  background: { default: '#0D0D0D', paper: '#121212' },
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
    disabled: 'rgba(255,255,255,0.5)',
  },
  primary: { main: '#1E90FF', contrastText: '#FFFFFF' }, // Electric Blue
  secondary: { main: '#00FF85', contrastText: '#000000' }, // Neon Green
  accent: '#FF0099', // Vivid Pink (hover)
  divider: 'rgba(255,255,255,0.12)',
  team1: '#1E90FF',
  team2: '#FF6F61', // Warm Accent
};

// ========================================
// テーマビルダー: mode (dark/light) のみ対応
// ========================================
function buildTheme(mode: 'dark' | 'light'): ThemeOptions {
  const S = NEON_SCHEME;

  // Light mode用の調整（基本実装済み、必要に応じてさらにカスタマイズ可能）
  const bgDefault = mode === 'dark' ? S.background.default : '#F5F5F5';
  const bgPaper = mode === 'dark' ? S.background.paper : '#FFFFFF';
  const textPrimary = mode === 'dark' ? S.text.primary : '#000000';
  const textSecondary = mode === 'dark' ? S.text.secondary : '#666666';

  return {
    palette: {
      mode,
      background: {
        default: bgDefault,
        paper: bgPaper,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        disabled: S.text.disabled,
      },
      primary: S.primary,
      secondary: S.secondary,
      divider: S.divider,
      // チームカラー
      team1: {
        main: S.team1,
        light: alpha(S.team1, 0.7),
        dark: alpha(S.team1, 0.9),
        contrastText: '#FFFFFF',
      },
      team2: {
        main: S.team2,
        light: alpha(S.team2, 0.7),
        dark: alpha(S.team2, 0.9),
        contrastText: '#FFFFFF',
      },
      // モメンタムチャート専用色（既存維持）
      momentum: {
        try: '#ff5722',
        positive: '#4caf50',
        negative: '#9c27b0',
        neutral: '#757575',
      },
      error: { main: '#d32f2f' },
      warning: { main: '#ed6c02' },
      info: { main: '#0288d1' },
      success: { main: '#2e7d32' },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    typography: {
      fontFamily: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'].join(
        ',',
      ),
      h6: { fontWeight: 700 },
      body2: { lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    shadows: [...new Array(25)].map(() => 'none') as ThemeOptions['shadows'],
    components: {
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingInline: 16,
            paddingBlock: 10,
          },
          containedPrimary: {
            boxShadow: '0 0 0 0 rgba(0,0,0,0)',
            '&:hover': {
              boxShadow: '0 0 16px 0 rgba(30,144,255,0.35)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backdropFilter: 'blur(8px)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { borderRadius: 10, backdropFilter: 'blur(6px)' },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: S.divider } },
      },
    },
    custom: {
      controllerButton: {
        color: '#ffffff',
        borderRadius: 12,
      },
      controllerPresetButton: {
        color: '#ffffff',
        borderRadius: 12,
        flexDirection: 'column',
      },
      // ===== セマンティックトークン =====
      rails: {
        timelineBg: mode === 'dark' ? bgDefault : '#F5F5F5',
        laneBg: mode === 'dark' ? '#0F0F0F' : '#FAFAFA',
      },
      bars: {
        team1: S.team1,
        team2: S.team2,
        selectedBorder: 'rgba(255,255,255,0.4)',
      },
      glass: {
        panel: 'rgba(0,0,0,0.72)',
        hover: 'rgba(255,255,255,0.12)',
        hoverStrong: 'rgba(255,255,255,0.24)',
      },
      accents: {
        hoverPink: S.accent,
      },
    },
  };
}

// ========================================
// エクスポート: getAppTheme 関数
// ========================================
export function getAppTheme(mode: 'dark' | 'light' = 'dark') {
  return createTheme(buildTheme(mode));
}
