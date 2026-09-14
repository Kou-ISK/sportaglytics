import { useCallback, useState } from 'react';
import type { DragEvent, HTMLAttributes } from 'react';
import { resolveDroppedPackagePath } from '../gateway/packageGateway';
export interface DragAndDropState {
  isDragging: boolean;
  isValidDrop: boolean;
}
export const useDragAndDrop = (
  onPackageDrop: (path: string) => void,
  onInvalidDrop: () => void = () => {},
  disabled = false,
): {
  dragState: DragAndDropState;
  handlers: HTMLAttributes<HTMLDivElement>;
} => {
  const [dragState, setDragState] = useState<DragAndDropState>({
    isDragging: false,
    isValidDrop: false,
  });
  const reset = (): void =>
    setDragState({ isDragging: false, isValidDrop: false });
  const enter = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      if (
        !Array.from(event.dataTransfer.items).some(
          (item) => item.kind === 'file',
        )
      )
        return;
      setDragState({
        isDragging: true,
        isValidDrop:
          event.dataTransfer.items.length === 1 &&
          event.dataTransfer.items[0]?.kind === 'file',
      });
    },
    [disabled],
  );
  return {
    dragState: disabled ? { isDragging: false, isValidDrop: false } : dragState,
    handlers: {
      onDragEnter: enter,
      onDragOver: (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      },
      onDragLeave: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX <= rect.left ||
          event.clientX >= rect.right ||
          event.clientY <= rect.top ||
          event.clientY >= rect.bottom
        )
          reset();
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        reset();
        if (disabled) return;
        const files = event.dataTransfer.files;
        // Text dragged from a recent-package row is not an attempt to open a file.
        if (
          files.length === 0 &&
          !Array.from(event.dataTransfer.types ?? []).includes('Files')
        )
          return;
        const path =
          files.length === 1 ? resolveDroppedPackagePath(files[0]) : '';
        if (path) onPackageDrop(path);
        else onInvalidDrop();
      },
    },
  };
};
