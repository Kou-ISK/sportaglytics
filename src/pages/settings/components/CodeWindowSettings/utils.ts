import { ulid } from 'ulid';
import type {
  CodeWindowButton,
  CodeWindowLayout,
  ActionLink,
  ButtonLink,
  TeamArea,
} from '../../../../types/Settings';

/** デフォルトのボタンサイズ（ピクセル） */
export const DEFAULT_BUTTON_WIDTH = 100;
export const DEFAULT_BUTTON_HEIGHT = 40;

/** デフォルトのキャンバスサイズ（ピクセル） */
export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;

/** デフォルトのチームエリア */
export const DEFAULT_TEAM1_AREA: TeamArea = {
  x: 0,
  y: 0,
  width: 400,
  height: 600,
};

export const DEFAULT_TEAM2_AREA: TeamArea = {
  x: 400,
  y: 0,
  width: 400,
  height: 600,
};

/**
 * 新しいボタンを作成（自由配置）
 */
export const createButton = (
  type: 'action' | 'label',
  name: string,
  x: number,
  y: number,
  options?: {
    labelValue?: string;
    width?: number;
    height?: number;
    team?: 'team1' | 'team2' | 'shared';
    color?: string;
  },
): CodeWindowButton => ({
  id: ulid(),
  type,
  name,
  labelValue: options?.labelValue,
  x,
  y,
  width: options?.width ?? DEFAULT_BUTTON_WIDTH,
  height: options?.height ?? DEFAULT_BUTTON_HEIGHT,
  team: options?.team ?? 'shared',
  color: options?.color,
});

/**
 * 新しいレイアウトを作成（自由配置キャンバス）
 */
export const createLayout = (
  name: string,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
  canvasHeight: number = DEFAULT_CANVAS_HEIGHT,
): CodeWindowLayout => ({
  id: ulid(),
  name,
  canvasWidth,
  canvasHeight,
  buttons: [],
  buttonLinks: [],
  splitByTeam: true,
  team1Area: {
    ...DEFAULT_TEAM1_AREA,
    width: canvasWidth / 2,
    height: canvasHeight,
  },
  team2Area: {
    ...DEFAULT_TEAM2_AREA,
    x: canvasWidth / 2,
    width: canvasWidth / 2,
    height: canvasHeight,
  },
});

/**
 * デフォルトレイアウトを作成（アクションリストから自動生成）
 */
export const createDefaultLayout = (actions: string[]): CodeWindowLayout => {
  const buttons: CodeWindowButton[] = [];
  const columns = 3;
  const buttonWidth = DEFAULT_BUTTON_WIDTH;
  const buttonHeight = DEFAULT_BUTTON_HEIGHT;
  const gap = 10;

  actions.forEach((action, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = col * (buttonWidth + gap) + gap;
    const y = row * (buttonHeight + gap) + gap;
    buttons.push(createButton('action', action, x, y));
  });

  const rowCount = Math.ceil(actions.length / columns);
  const canvasHeight = Math.max(
    DEFAULT_CANVAS_HEIGHT,
    rowCount * (buttonHeight + gap) + gap * 2,
  );

  return {
    id: 'default',
    name: 'デフォルト',
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight,
    buttons,
    buttonLinks: [],
    splitByTeam: true,
    team1Area: {
      x: 0,
      y: 0,
      width: DEFAULT_CANVAS_WIDTH / 2,
      height: canvasHeight,
    },
    team2Area: {
      x: DEFAULT_CANVAS_WIDTH / 2,
      y: 0,
      width: DEFAULT_CANVAS_WIDTH / 2,
      height: canvasHeight,
    },
  };
};

/**
 * 新しいリンク（ラベル→アクション）を作成
 */
export const createLink = (
  from: string,
  to: string,
  type: ActionLink['type'],
): ActionLink => ({
  id: ulid(),
  from,
  to,
  type,
});

/**
 * 新しいボタン間リンクを作成
 * Sportscodeでは右クリックドラッグで排他リンク（exclusive）を作成
 */
export const createButtonLink = (
  fromButtonId: string,
  toButtonId: string,
  type: ButtonLink['type'] = 'exclusive',
): ButtonLink => ({
  id: ulid(),
  fromButtonId,
  toButtonId,
  type,
});

/**
 * ボタンが指定エリア内にあるかチェック
 */
export const isButtonInArea = (
  button: CodeWindowButton,
  area: TeamArea,
): boolean => {
  return (
    button.x >= area.x &&
    button.y >= area.y &&
    button.x + button.width <= area.x + area.width &&
    button.y + button.height <= area.y + area.height
  );
};

/**
 * 2つのボタンが重なっているかチェック
 */
export const isOverlapping = (
  button1: CodeWindowButton,
  button2: CodeWindowButton,
): boolean => {
  return !(
    button1.x + button1.width <= button2.x ||
    button2.x + button2.width <= button1.x ||
    button1.y + button1.height <= button2.y ||
    button2.y + button2.height <= button1.y
  );
};

/**
 * ボタンが他のボタンと重ならないかチェック
 */
export const canPlaceButton = (
  buttons: CodeWindowButton[],
  button: CodeWindowButton,
  targetX: number,
  targetY: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean => {
  // キャンバス範囲内かチェック
  if (
    targetX < 0 ||
    targetY < 0 ||
    targetX + button.width > canvasWidth ||
    targetY + button.height > canvasHeight
  ) {
    return false;
  }

  // 他のボタンと重ならないかチェック
  const testButton = { ...button, x: targetX, y: targetY };
  return !buttons.some(
    (b) => b.id !== button.id && isOverlapping(testButton, b),
  );
};

/**
 * 空いているスペースを見つける
 */
export const findEmptySpace = (
  buttons: CodeWindowButton[],
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
  preferredArea?: TeamArea,
): { x: number; y: number } | null => {
  const step = 10; // 検索ステップ（ピクセル）
  const startX = preferredArea?.x ?? 0;
  const startY = preferredArea?.y ?? 0;
  const endX = preferredArea
    ? preferredArea.x + preferredArea.width
    : canvasWidth;
  const endY = preferredArea
    ? preferredArea.y + preferredArea.height
    : canvasHeight;

  for (let y = startY; y + height <= endY; y += step) {
    for (let x = startX; x + width <= endX; x += step) {
      const testButton: CodeWindowButton = {
        id: 'test',
        type: 'action',
        name: '',
        x,
        y,
        width,
        height,
        team: 'shared',
      };
      if (
        canPlaceButton(buttons, testButton, x, y, canvasWidth, canvasHeight)
      ) {
        return { x, y };
      }
    }
  }
  return null;
};

/**
 * ボタンをグリッドにスナップ
 */
export const snapToGrid = (value: number, gridSize: number = 10): number => {
  return Math.round(value / gridSize) * gridSize;
};

/**
 * ボタンの中心座標を取得
 */
export const getButtonCenter = (
  button: CodeWindowButton,
): { x: number; y: number } => ({
  x: button.x + button.width / 2,
  y: button.y + button.height / 2,
});
