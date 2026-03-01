import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type {
  DashboardAnalysisMode,
  DashboardChartType,
  DashboardSeriesFilter,
} from '../../../../../../../types/Settings';

export const generateWidgetId = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const resolveDefaultGroup = (
  availableGroups: string[],
  preferred: string,
): string => {
  if (availableGroups.includes(preferred)) return preferred;
  if (availableGroups.length > 0) return availableGroups[0];
  return 'all_labels';
};

export const getAxisLabel = (axis: MatrixAxisConfig): string => {
  if (axis.type === 'team') return 'チーム';
  if (axis.type === 'action') return 'アクション(actionName)';
  if (axis.type !== 'group') return '未設定';
  if (axis.value === 'all_labels') return '全ラベル';
  return axis.value || 'ラベルグループ';
};

export const getChartLabel = (type: DashboardChartType): string => {
  if (type === 'bar') return 'バー';
  if (type === 'stacked') return '積み上げ';
  return '円';
};

export const getAnalysisModeLabel = (mode: DashboardAnalysisMode): string => {
  if (mode === 'trend') return 'トレンド';
  if (mode === 'histogram') return 'ヒストグラム';
  if (mode === 'rolling') return 'ローリング';
  if (mode === 'outlier') return '外れ値';
  return '標準集計';
};

export const buildFilterSummary = (filters: DashboardSeriesFilter): string[] => {
  const parts: string[] = [];
  if (filters.team) parts.push(`チーム=${filters.team}`);
  if (filters.action) parts.push(`アクション=${filters.action}`);
  if (filters.labelGroup) {
    const label = filters.labelValue
      ? `${filters.labelGroup}:${filters.labelValue}`
      : filters.labelGroup;
    parts.push(`ラベル=${label}`);
  }
  return parts;
};

export const normalizePositive = (value: number | '', fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};
