import type {
  TacticalBoard,
  TacticalPoint,
} from '../../types/playlist/tacticalBoard';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 200;

export const isValidTacticalBoard = (
  value: unknown,
): value is TacticalBoard => {
  if (
    !record(value) ||
    !positive(value.widthMeters) ||
    !positive(value.lengthMeters) ||
    typeof value.time !== 'number' ||
    !Number.isFinite(value.time) ||
    value.time < 0 ||
    !Array.isArray(value.markers) ||
    value.markers.length > 64 ||
    !Array.isArray(value.arrows) ||
    value.arrows.length > 64
  )
    return false;
  const width = value.widthMeters,
    length = value.lengthMeters;
  const point = (p: unknown): p is TacticalPoint =>
    record(p) &&
    typeof p.x === 'number' &&
    Number.isFinite(p.x) &&
    p.x >= 0 &&
    p.x <= width &&
    typeof p.y === 'number' &&
    Number.isFinite(p.y) &&
    p.y >= 0 &&
    p.y <= length;
  const ids = new Set<string>();
  const id = (v: Record<string, unknown>): boolean => {
    if (typeof v.id !== 'string' || !v.id || v.id.length > 128 || ids.has(v.id))
      return false;
    ids.add(v.id);
    return true;
  };
  return (
    value.markers.every(
      (m: unknown) =>
        record(m) &&
        point(m) &&
        id(m) &&
        ['team1', 'team2', 'neutral', 'ball'].includes(String(m.kind)) &&
        typeof m.label === 'string' &&
        m.label.length <= 8,
    ) &&
    value.arrows.every(
      (a: unknown) => record(a) && id(a) && point(a.from) && point(a.to),
    )
  );
};

export const constrainBoardPoint = (
  board: Pick<TacticalBoard, 'widthMeters' | 'lengthMeters'>,
  point: TacticalPoint,
): TacticalPoint => ({
  x: Math.max(0, Math.min(board.widthMeters, point.x)),
  y: Math.max(0, Math.min(board.lengthMeters, point.y)),
});
