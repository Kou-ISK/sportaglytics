import { useCallback, useLayoutEffect } from 'react';
import type {
  PlaylistAngle,
  PlaylistItem,
} from '../../../../types/playlist/core';

interface Options {
  currentItem: PlaylistItem | null;
  setItems: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setViewMode: React.Dispatch<React.SetStateAction<'dual' | PlaylistAngle>>;
  setDirty: (dirty: boolean) => void;
}

/** Preview shortcuts are temporary; the default angle belongs to the document. */
export const usePlaylistInstanceAngles = ({
  currentItem,
  setItems,
  setViewMode,
  setDirty,
}: Options): {
  setDefaultAngle: (id: string, angle: PlaylistAngle) => void;
} => {
  const id = currentItem?.id;
  const angle = currentItem?.defaultAngle ?? 'angle1';
  useLayoutEffect(() => {
    if (id) setViewMode(angle);
  }, [id, angle, setViewMode]);

  const setDefaultAngle = useCallback(
    (itemId: string, next: PlaylistAngle): void => {
      setItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, defaultAngle: next } : item,
        ),
      );
      setDirty(true);
    },
    [setItems, setDirty],
  );
  return { setDefaultAngle };
};
