import type { ThemeOptions } from '@mui/material/styles';
import type { SemanticTokens } from '../tokens/semantic';
import { elevationTokens } from '../tokens/elevation';
import { motionTokens } from '../tokens/motion';
import { primitiveShape } from '../tokens/primitive';
import { densityTokens } from '../tokens/density';
import { typographyScale } from '../tokens/typography';
import { zIndexTokens } from '../tokens/zIndex';

export const buildComponents = (
  tokens: SemanticTokens,
): ThemeOptions['components'] => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: { fontVariantNumeric: 'tabular-nums' },
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.border.strong} ${tokens.surface.canvas}`,
      },
      '::selection': { backgroundColor: tokens.interactive.selected },
      'code, kbd, pre': {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      '*:focus-visible': {
        outline: `2px solid ${tokens.border.focus}`,
        outlineOffset: '2px',
      },
      '@media (prefers-reduced-motion: reduce)': {
        '*': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        boxShadow: elevationTokens.none,
      },
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true, size: 'small' },
    styleOverrides: {
      root: {
        borderRadius: primitiveShape.radiusLg,
        minHeight: densityTokens.compact.interactiveTarget,
        paddingInline: 10,
        paddingBlock: 4,
        fontSize: typographyScale.bodyCompact.fontSize,
        transition: motionTokens.transitionInteractive,
      },
      containedPrimary: {
        boxShadow: elevationTokens.none,
        '&:hover': {
          backgroundColor: tokens.interactive.primary,
          filter: 'brightness(1.08)',
        },
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        minWidth: 32,
        minHeight: 32,
        borderRadius: primitiveShape.radiusLg,
        transition: motionTokens.transitionInteractive,
        '&:hover': { backgroundColor: tokens.surface.hover },
        '&.Mui-focusVisible': {
          outline: `2px solid ${tokens.border.focus}`,
          outlineOffset: '2px',
        },
      },
    },
  },
  MuiTooltip: {
    defaultProps: { arrow: true },
    styleOverrides: {
      tooltip: {
        borderRadius: primitiveShape.radiusMd,
        backgroundColor: tokens.surface.overlay,
        color: tokens.content.primary,
        border: `1px solid ${tokens.border.subtle}`,
      },
      arrow: { color: tokens.surface.overlay },
    },
  },
  MuiTextField: { defaultProps: { size: 'small' } },
  MuiFormControl: { defaultProps: { size: 'small' } },
  MuiSelect: { defaultProps: { size: 'small' } },
  MuiOutlinedInput: {
    defaultProps: { size: 'small' },
    styleOverrides: {
      root: {
        backgroundColor: tokens.surface.work,
        borderRadius: primitiveShape.radiusMd,
        minHeight: densityTokens.compact.interactiveTarget,
        fontSize: typographyScale.bodyCompact.fontSize,
        '&.MuiInputBase-multiline': { padding: '6px 10px' },
      },
      notchedOutline: { borderColor: tokens.border.strong },
      input: {
        paddingBlock: 6,
        '&.MuiInputBase-inputMultiline': { padding: 0 },
      },
    },
  },
  MuiTabs: {
    styleOverrides: { root: { minHeight: 38 }, indicator: { height: 2 } },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        minHeight: 38,
        padding: '8px 14px',
        textTransform: 'none',
        fontWeight: 650,
      },
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        padding: '5px 12px',
        borderColor: tokens.border.subtle,
        color: tokens.content.secondary,
        '&.Mui-selected': {
          color: tokens.content.primary,
          backgroundColor: tokens.surface.raised,
          borderColor: tokens.border.strong,
        },
        '&.Mui-selected:hover': { backgroundColor: tokens.surface.hover },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: tokens.border.subtle,
        padding: '6px 10px',
        fontVariantNumeric: 'tabular-nums',
      },
      head: {
        backgroundColor: tokens.surface.raised,
        color: tokens.content.secondary,
        fontSize: '0.75rem',
        fontWeight: 700,
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: { '&.Mui-selected': { backgroundColor: tokens.surface.selected } },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: primitiveShape.radiusSm, fontWeight: 600 },
      sizeSmall: { height: 24 },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        border: `1px solid ${tokens.border.strong}`,
        boxShadow: elevationTokens.overlay,
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        padding: '10px 16px',
        borderBottom: `1px solid ${tokens.border.subtle}`,
        fontSize: '1rem',
        fontWeight: 700,
      },
    },
  },
  MuiDialogContent: { styleOverrides: { root: { padding: '12px 16px' } } },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: '8px 16px',
        borderTop: `1px solid ${tokens.border.subtle}`,
        gap: 4,
      },
    },
  },
  MuiMenuItem: {
    defaultProps: {
      onMouseEnter: (event) =>
        event.currentTarget.focus({ preventScroll: true }),
    },
    styleOverrides: {
      root: {
        fontSize: '0.8125rem',
        minHeight: 30,
        padding: '4px 10px',
        lineHeight: 1.4,
        '& .MuiListItemText-primary': {
          fontSize: 'inherit',
          fontWeight: 400,
          lineHeight: 'inherit',
        },
        '& .MuiListItemIcon-root': {
          minWidth: 28,
          color: 'inherit',
          opacity: 0.8,
        },
        '& .MuiSvgIcon-root': { fontSize: 17 },
        '&.Mui-focusVisible, &:hover': {
          backgroundColor: tokens.interactive.primary,
          color: tokens.content.inverse,
        },
        borderRadius: primitiveShape.radiusSm,
        marginInline: 4,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        '&.Mui-selected': {
          backgroundColor: tokens.surface.selected,
          borderLeft: `2px solid ${tokens.border.focus}`,
        },
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: primitiveShape.radiusMd },
      message: { minWidth: 0, overflowWrap: 'anywhere' },
    },
  },
  MuiDivider: {
    styleOverrides: { root: { borderColor: tokens.border.subtle } },
  },
  MuiMenu: {
    defaultProps: { transitionDuration: 120 },
    styleOverrides: {
      list: { paddingBlock: 5, '& .MuiDivider-root': { margin: '5px 10px' } },
      paper: {
        backgroundColor: tokens.surface.overlay,
        backgroundImage: 'none',
        borderRadius: primitiveShape.radiusMd,
        color: tokens.content.primary,
        border: `1px solid ${tokens.border.subtle}`,
        boxShadow: elevationTokens.overlay,
        zIndex: zIndexTokens.overlay,
      },
    },
  },
});
