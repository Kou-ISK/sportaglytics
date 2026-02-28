import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';

export const getAxisLabel = (
  axis: MatrixAxisConfig,
  availableGroups: string[],
): string => {
  switch (axis.type) {
    case 'group': {
      const value = axis.value || availableGroups[0] || 'グループ';
      if (value === 'all_labels') return '全ラベル';
      return `ラベル: ${value}`;
    }
    case 'team':
      return 'チーム';
    case 'action':
      return axis.value ? `アクション (${axis.value})` : 'アクション';
    default:
      return '不明';
  }
};
