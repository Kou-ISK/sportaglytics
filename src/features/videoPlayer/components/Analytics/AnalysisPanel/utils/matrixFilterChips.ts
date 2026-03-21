import { MATRIX_FILTER_ALL, type MatrixFilterState } from '../controllers/matrixFilterUtils';

interface MatrixFilterChip {
  label: string;
  onDelete: () => void;
}

interface BuildMatrixFilterChipsParams {
  filters: MatrixFilterState;
  onResetTeam: () => void;
  onResetAction: () => void;
  onResetLabels: () => void;
}

export const buildMatrixFilterChips = ({
  filters,
  onResetTeam,
  onResetAction,
  onResetLabels,
}: BuildMatrixFilterChipsParams): MatrixFilterChip[] => {
  const chips: MatrixFilterChip[] = [];
  const all = MATRIX_FILTER_ALL;

  if (filters.team !== all) {
    chips.push({
      label: `チーム: ${filters.team}`,
      onDelete: onResetTeam,
    });
  }

  if (filters.action !== all) {
    chips.push({
      label: `アクション: ${filters.action}`,
      onDelete: onResetAction,
    });
  }

  if (filters.labelGroup !== all && filters.labelValue !== all) {
    chips.push({
      label: `${filters.labelGroup}: ${filters.labelValue}`,
      onDelete: onResetLabels,
    });
  } else if (filters.labelGroup !== all) {
    chips.push({
      label: `ラベルグループ: ${filters.labelGroup}`,
      onDelete: onResetLabels,
    });
  }

  return chips;
};
