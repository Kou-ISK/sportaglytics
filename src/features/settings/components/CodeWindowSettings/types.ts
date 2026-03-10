import type {
  CodeWindowButton,
  CodeWindowLayout,
  ActionLink,
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
 * リンクエディタのprops
 */
export interface LinkEditorProps {
  links: ActionLink[];
  onLinksChange: (links: ActionLink[]) => void;
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

/**
 * リンクタイプの表示名
 */
export const LINK_TYPE_LABELS: Record<ActionLink['type'], string> = {
  exclusive: '排他（どちらか一方のみ）',
  deactivate: '無効化（fromを押すとtoを終了）',
  activate: '有効化（fromを押すとtoも開始）',
};
