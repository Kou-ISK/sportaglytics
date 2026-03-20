import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/Settings';

/**
 * ボタンエディタのドラッグ状態
 */
export interface DragState {
  isDragging: boolean;
  draggedButton: CodeWindowButton | null;
  dragOffset: { x: number; y: number };
}

/**
 * グリッドセルの状態
 */
export interface GridCell {
  row: number;
  col: number;
  button: CodeWindowButton | null;
  isOccupied: boolean;
}

/**
 * ボタンエディタのprops
 */
export interface ButtonEditorProps {
  layout: CodeWindowLayout;
  onLayoutChange: (layout: CodeWindowLayout) => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
}

/**
 * レイアウト選択のprops
 */
export interface LayoutSelectorProps {
  layouts: CodeWindowLayout[];
  activeLayoutId: string | undefined;
  onSelectLayout: (id: string) => void;
  onCreateLayout: () => void;
  onDeleteLayout: (id: string) => void;
  onDuplicateLayout: (id: string) => void;
}

/**
 * ボタンプロパティエディタのprops
 */
export interface ButtonPropertiesProps {
  button: CodeWindowButton | null;
  onUpdate: (button: CodeWindowButton) => void;
  onDelete: () => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
}

/**
 * デフォルトのボタン色
 */
export const DEFAULT_BUTTON_COLORS = {
  action: '#1976d2',
  label: '#9c27b0',
};
