export interface AngleSyncTrack {
  name: string;
  point: number | null;
}

export interface AngleSyncSnapshot {
  angles: AngleSyncTrack[];
  selected: number | null;
  busy: boolean;
  saving: boolean;
  analyzing: boolean;
  changed: boolean;
  canMark: boolean;
  canAlign: boolean;
  frameAvailable: boolean;
  message: string;
}

export type AngleSyncCommand =
  | { action: 'select'; index: number | null }
  | { action: 'step'; direction: -1 | 1 }
  | { action: 'skip'; seconds: -1 | 1 }
  | {
      action:
        | 'mark'
        | 'remove-point'
        | 'align'
        | 'toggle'
        | 'save'
        | 'cancel'
        | 'reset'
        | 'audio';
    };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const time = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= 86400;

export const isAngleSyncSnapshot = (
  value: unknown,
): value is AngleSyncSnapshot =>
  object(value) &&
  Array.isArray(value.angles) &&
  value.angles.length <= 8 &&
  value.angles.every(
    (angle: unknown) =>
      object(angle) &&
      typeof angle.name === 'string' &&
      (angle.point === null || time(angle.point)),
  ) &&
  (value.selected === null ||
    (Number.isInteger(value.selected) &&
      typeof value.selected === 'number' &&
      value.selected >= 0 &&
      value.selected < value.angles.length)) &&
  [
    'busy',
    'saving',
    'analyzing',
    'changed',
    'canMark',
    'canAlign',
    'frameAvailable',
  ].every((key) => typeof value[key] === 'boolean') &&
  typeof value.message === 'string';

export const isAngleSyncCommand = (
  value: unknown,
): value is AngleSyncCommand => {
  if (!object(value)) return false;
  switch (value.action) {
    case 'select':
      return (
        value.index === null ||
        (typeof value.index === 'number' &&
          Number.isInteger(value.index) &&
          value.index >= 0 &&
          value.index < 8)
      );
    case 'step':
      return value.direction === -1 || value.direction === 1;
    case 'skip':
      return value.seconds === -1 || value.seconds === 1;
    default:
      return (
        typeof value.action === 'string' &&
        [
          'mark',
          'remove-point',
          'align',
          'toggle',
          'save',
          'cancel',
          'reset',
          'audio',
        ].includes(value.action)
      );
  }
};
