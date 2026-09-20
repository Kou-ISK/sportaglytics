// @vitest-environment jsdom
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import type {
  ItemAnnotation,
  PlaylistItem,
} from '../../../../types/playlist/core';
import { studioObjects } from '../../fixtures/studio';
import { usePlaylistAnnotations } from './usePlaylistAnnotations';
import { usePlaylistHistory } from './usePlaylistHistory';

const initial: PlaylistItem[] = [
  {
    id: 'clip',
    timelineItemId: 'one',
    actionName: 'Attack',
    startTime: 10,
    endTime: 20,
    addedAt: 1,
    videoSource: './videos/clip.mp4',
    annotation: {
      freezeAt: 0,
      freezeDuration: 3,
      objects: [
        {
          ...studioObjects[0],
          id: 'other-angle',
          target: 'secondary',
          timestamp: 2,
        },
      ],
    },
  },
];
it('stores Studio edits with embedded timestamps and preserves the other angle through undo', () => {
  const { result } = renderHook(() => {
    const history = usePlaylistHistory(initial);
    const [annotations, setAnnotations] = useState<
      Record<string, ItemAnnotation>
    >({});
    const [dirty, setDirty] = useState(false);
    const editor = usePlaylistAnnotations({
      currentItem: history.items[0],
      itemAnnotations: annotations,
      setItemAnnotations: setAnnotations,
      setItemsWithHistory: history.setItems,
      setHasUnsavedChanges: setDirty,
      minFreezeDuration: 1,
      defaultFreezeDuration: 3,
    });
    return { history, editor, dirty };
  });
  act(() =>
    result.current.editor.handleAnnotationObjectsChange(
      studioObjects,
      'primary',
      { color: '#207030', similarity: 0.14, blend: 0.04 },
    ),
  );
  expect(
    result.current.history.items[0].annotation?.chromaKey?.primary?.color,
  ).toBe('#207030');
  expect(result.current.dirty).toBe(true);
  const annotation = result.current.history.items[0].annotation!;
  expect(
    annotation.objects.find((object) => object.id === 'run')?.timestamp,
  ).toBe(2);
  expect(
    annotation.objects.find((object) => object.id === 'other-angle')?.timestamp,
  ).toBe(2);
  expect(
    result.current.editor.currentAnnotation?.objects.find(
      (object) => object.id === 'run',
    )?.timestamp,
  ).toBe(12);
  expect(
    JSON.parse(JSON.stringify(result.current.history.items))[0].annotation
      .objects,
  ).toEqual(annotation.objects);
  act(() => {
    result.current.history.undo();
  });
  expect(result.current.history.items[0].annotation?.chromaKey).toBeUndefined();
  expect(result.current.history.items[0].annotation?.objects).toEqual(
    initial[0].annotation?.objects,
  );
});

it('commits a tactical board without shifting clip-relative time or losing opposite-angle metadata', () => {
  const board = {
    widthMeters: 70,
    lengthMeters: 100,
    time: 2,
    markers: [],
    arrows: [],
  };
  const { result } = renderHook(() => {
    const history = usePlaylistHistory([
      {
        ...initial[0],
        annotation: {
          ...initial[0].annotation!,
          tacticalBoard: { secondary: { ...board, time: 1 } },
        },
      },
    ]);
    const [annotations, setAnnotations] = useState<
      Record<string, ItemAnnotation>
    >({});
    const [, setDirty] = useState(false);
    const editor = usePlaylistAnnotations({
      currentItem: history.items[0],
      itemAnnotations: annotations,
      setItemAnnotations: setAnnotations,
      setItemsWithHistory: history.setItems,
      setHasUnsavedChanges: setDirty,
      minFreezeDuration: 1,
      defaultFreezeDuration: 3,
    });
    return { history, editor };
  });
  act(() => result.current.editor.handleTacticalBoardChange(board, 'primary'));
  expect(result.current.history.items[0].annotation?.tacticalBoard).toEqual({
    primary: board,
    secondary: { ...board, time: 1 },
  });
  expect(
    result.current.editor.currentAnnotation?.tacticalBoard?.primary?.time,
  ).toBe(2);
  act(() => result.current.history.undo());
  expect(
    result.current.history.items[0].annotation?.tacticalBoard?.primary,
  ).toBeUndefined();
  expect(
    result.current.history.items[0].annotation?.tacticalBoard?.secondary?.time,
  ).toBe(1);
});
