import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  TacticalBoard,
  TacticalMarker,
  TacticalMarkerKind,
  TacticalPoint,
} from '../../../../types/playlist/tacticalBoard';
import { constrainBoardPoint } from '../../../../shared/tactics/tacticalBoard';
export type BoardTool = 'select' | 'arrow' | TacticalMarkerKind;
export interface TacticalBoardEditor {
  board: TacticalBoard;
  selectedId: string | null;
  tool: BoardTool;
  arrowStart: TacticalPoint | null;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: BoardTool) => void;
  onSelect: (id: string | null) => void;
  onPlace: (point: TacticalPoint) => void;
  onMove: (id: string, point: TacticalPoint, complete: boolean) => void;
  onCancelMove: () => void;
  onUpdate: (patch: Partial<Pick<TacticalMarker, 'label' | 'kind'>>) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onImport: (markers: TacticalMarker[]) => void;
  reset: (board: TacticalBoard) => void;
  onReplace: (board: TacticalBoard) => void;
}
export const useTacticalBoardEditor = (
  initial: TacticalBoard,
): TacticalBoardEditor => {
  const [history, setHistory] = useState({ entries: [initial], index: 0 });
  const [preview, setPreview] = useState<TacticalBoard | null>(null);
  const [selection, select] = useState<string | null>(null);
  const [tool, setTool] = useState<BoardTool>('select');
  const [arrowStart, setArrowStart] = useState<TacticalPoint | null>(null);
  const drag = useRef<TacticalBoard | null>(null);
  const board = preview ?? history.entries[history.index];
  const selectedId =
    board.markers.some((m) => m.id === selection) ||
    board.arrows.some((a) => a.id === selection)
      ? selection
      : null;
  const commit = (next: TacticalBoard): void => {
    setPreview(null);
    drag.current = null;
    setHistory((previous) => {
      const entries = [
        ...previous.entries.slice(0, previous.index + 1),
        next,
      ].slice(-101);
      return { entries, index: entries.length - 1 };
    });
  };
  const onDelete = (): void => {
    if (!selectedId) return;
    commit({
      ...board,
      markers: board.markers.filter((m) => m.id !== selectedId),
      arrows: board.arrows.filter((a) => a.id !== selectedId),
    });
    select(null);
  };
  const onUndo = (): void => {
    setPreview(null);
    drag.current = null;
    setArrowStart(null);
    setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
  };
  const onRedo = (): void => {
    setPreview(null);
    drag.current = null;
    setArrowStart(null);
    setHistory((h) => ({
      ...h,
      index: Math.min(h.entries.length - 1, h.index + 1),
    }));
  };
  return {
    board,
    onReplace: (next) => {
      commit(next);
      select(null);
      setArrowStart(null);
    },
    selectedId,
    tool,
    arrowStart,
    reset: (next) => {
      setHistory({ entries: [next], index: 0 });
      setPreview(null);
      select(null);
      setArrowStart(null);
      setTool('select');
      drag.current = null;
    },
    canUndo: history.index > 0,
    canRedo: history.index < history.entries.length - 1,
    onSelect: select,
    onTool: (next) => {
      setTool(next);
      setArrowStart(null);
      select(null);
    },
    onPlace: (raw) => {
      const point = constrainBoardPoint(board, raw);
      if (tool === 'select') {
        select(null);
        return;
      }
      if (tool === 'arrow') {
        if (!arrowStart) {
          setArrowStart(point);
          return;
        }
        if (
          board.arrows.length < 64 &&
          Math.hypot(point.x - arrowStart.x, point.y - arrowStart.y) > 0.1
        )
          commit({
            ...board,
            arrows: [
              ...board.arrows,
              { id: crypto.randomUUID(), from: arrowStart, to: point },
            ],
          });
        setArrowStart(null);
        return;
      }
      if (board.markers.length >= 64) return;
      const id = crypto.randomUUID();
      commit({
        ...board,
        markers: [
          ...board.markers,
          {
            id,
            ...point,
            kind: tool,
            label:
              tool === 'ball'
                ? ''
                : String(
                    board.markers.filter((m) => m.kind === tool).length + 1,
                  ),
          },
        ],
      });
      select(id);
    },
    onMove: (id, raw, complete) => {
      if (!drag.current) drag.current = history.entries[history.index];
      const next = {
        ...drag.current,
        markers: drag.current.markers.map((m) =>
          m.id === id ? { ...m, ...constrainBoardPoint(board, raw) } : m,
        ),
      };
      if (complete) {
        if (JSON.stringify(next) !== JSON.stringify(drag.current)) commit(next);
        else {
          drag.current = null;
          setPreview(null);
        }
      } else setPreview(next);
    },
    onCancelMove: () => {
      setPreview(null);
      drag.current = null;
    },
    onUpdate: (patch) => {
      if (selectedId)
        commit({
          ...board,
          markers: board.markers.map((m) =>
            m.id === selectedId ? { ...m, ...patch } : m,
          ),
        });
    },
    onDelete,
    onUndo,
    onRedo,
    onImport: (markers) =>
      commit({
        ...board,
        markers: [
          ...board.markers,
          ...markers.map((m) => ({ ...m, id: crypto.randomUUID() })),
        ].slice(0, 64),
      }),
    onKeyDown: (event) => {
      event.stopPropagation();
      if (
        event.target instanceof Element &&
        event.target.closest('input,textarea,[contenteditable="true"]')
      )
        return;
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        onDelete();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
      }
      if (event.key === 'Escape' && arrowStart) {
        event.preventDefault();
        setArrowStart(null);
      }
    },
  };
};
