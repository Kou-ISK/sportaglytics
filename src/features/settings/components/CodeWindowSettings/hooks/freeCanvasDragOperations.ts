import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import {
  createButtonLink,
  DEFAULT_BUTTON_HEIGHT,
  DEFAULT_BUTTON_WIDTH,
  snapToGrid,
} from '../utils';

export const moveSelectedButtons = ({
  layout,
  draggedButton,
  snapshot,
  pointer,
  dragOffset,
  gridSize,
}: {
  layout: CodeWindowLayout;
  draggedButton: CodeWindowButton;
  snapshot: Record<string, { x: number; y: number }>;
  pointer: { x: number; y: number };
  dragOffset: { x: number; y: number };
  gridSize: number;
}) => {
  const primaryStart = snapshot[draggedButton.id] ?? {
    x: draggedButton.x,
    y: draggedButton.y,
  };
  const targetX = snapToGrid(pointer.x - dragOffset.x, gridSize);
  const targetY = snapToGrid(pointer.y - dragOffset.y, gridSize);
  const deltaX = targetX - primaryStart.x;
  const deltaY = targetY - primaryStart.y;

  const updatedButtons = layout.buttons.map((button) => {
    const startPos = snapshot[button.id];
    if (!startPos) return button;
    const nextX = Math.max(
      0,
      Math.min(layout.canvasWidth - button.width, startPos.x + deltaX),
    );
    const nextY = Math.max(
      0,
      Math.min(layout.canvasHeight - button.height, startPos.y + deltaY),
    );
    return { ...button, x: nextX, y: nextY };
  });

  return {
    ...layout,
    buttons: updatedButtons,
  };
};

export const resizeButton = ({
  layout,
  draggedButton,
  pointer,
  gridSize,
}: {
  layout: CodeWindowLayout;
  draggedButton: CodeWindowButton;
  pointer: { x: number; y: number };
  gridSize: number;
}) => {
  const newWidth = snapToGrid(
    Math.max(DEFAULT_BUTTON_WIDTH / 2, pointer.x - draggedButton.x),
    gridSize,
  );
  const newHeight = snapToGrid(
    Math.max(DEFAULT_BUTTON_HEIGHT / 2, pointer.y - draggedButton.y),
    gridSize,
  );
  const updatedButtons = layout.buttons.map((button) =>
    button.id === draggedButton.id
      ? { ...button, width: newWidth, height: newHeight }
      : button,
  );
  return {
    ...layout,
    buttons: updatedButtons,
  };
};

export const findTargetButton = ({
  layout,
  sourceButtonId,
  pointer,
}: {
  layout: CodeWindowLayout;
  sourceButtonId: string;
  pointer: { x: number; y: number };
}) => {
  return layout.buttons.find((button) => {
    return (
      button.id !== sourceButtonId &&
      pointer.x >= button.x &&
      pointer.x <= button.x + button.width &&
      pointer.y >= button.y &&
      pointer.y <= button.y + button.height
    );
  });
};

export const addLayoutLink = ({
  layout,
  fromButtonId,
  toButtonId,
  linkType,
}: {
  layout: CodeWindowLayout;
  fromButtonId: string;
  toButtonId: string;
  linkType: 'exclusive' | 'activate' | 'deactivate';
}) => {
  const existingLink = layout.buttonLinks?.find(
    (link) =>
      (link.fromButtonId === fromButtonId && link.toButtonId === toButtonId) ||
      (link.fromButtonId === toButtonId && link.toButtonId === fromButtonId),
  );
  if (existingLink) {
    return null;
  }

  const newLink = createButtonLink(fromButtonId, toButtonId, linkType);
  return {
    ...layout,
    buttonLinks: [...(layout.buttonLinks || []), newLink],
  };
};

export const removeButtonAndRelatedLinks = ({
  layout,
  buttonId,
}: {
  layout: CodeWindowLayout;
  buttonId: string;
}) => {
  return {
    ...layout,
    buttons: layout.buttons.filter((button) => button.id !== buttonId),
    buttonLinks: layout.buttonLinks?.filter(
      (link) => link.fromButtonId !== buttonId && link.toButtonId !== buttonId,
    ),
  };
};
