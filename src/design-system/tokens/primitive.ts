/**
 * Primitive values are the only place where raw visual values are defined.
 * Components should consume semantic tokens instead of these values directly.
 */
export const primitiveColors = {
  signalBlue: '#64A9FF',
  signalBlueLight: '#0067CE',
  textCool: '#F5F5F7',
  textMuted: '#B3B3BA',
  ink: '#1D1D1F',
  neonBlue: '#1E90FF',
  neonGreen: '#00FF85',
  vividPink: '#FF0099',
  warmCoral: '#FF6F61',
  nearBlack: '#18181B',
  charcoal: '#242426',
  charcoalRaised: '#303034',
  white: '#FFFFFF',
  black: '#000000',
  neutral50: '#F0F0F2',
  neutral100: '#F5F5F7',
  neutral400: '#BDBDBD',
  neutral600: '#666666',
  neutral700: '#616161',
  error: '#D32F2F',
  warning: '#ED6C02',
  info: '#0288D1',
  success: '#2E7D32',
  pitchGreen: '#244B3C',
  momentumTry: '#FF5722',
  momentumPositive: '#4CAF50',
  momentumNegative: '#9C27B0',
  momentumNeutral: '#757575',
} as const;

export const primitiveSpacing = {
  unit: 8,
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const primitiveShape = {
  radiusNone: 0,
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 10,
  radiusRound: 999,
} as const;

export const primitiveSizes = {
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  controlCompact: 28,
  controlStandard: 36,
  interactiveMin: 32,
  interactiveComfortable: 44,
} as const;

export type PrimitiveColor =
  (typeof primitiveColors)[keyof typeof primitiveColors];
