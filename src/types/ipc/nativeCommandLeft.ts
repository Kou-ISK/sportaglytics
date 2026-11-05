export type NativeGesturePhase = 'active' | 'ended' | 'invalid';
export const nativeCommandLeftChannels = {
  ready: 'native-command-left:ready',
  claim: 'native-command-left:claim',
  apply: 'native-command-left:apply',
  retire: 'native-command-left:retire',
  revoke: 'native-command-left:revoke',
  event: 'native-command-left:event',
  overflow: 'native-command-left:overflow',
  acknowledgement: 'native-command-left:acknowledgement',
} as const;
import {
  booleanValue,
  enumValue,
  exactKeys,
  integerValue,
  objectValue,
} from '../../shared/validation/jsonValues';

export interface NativeCommandLeftEvent {
  phase: 'down' | 'up' | 'cancel';
  gesture: number;
  serial: number;
  epoch: number;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  control: boolean;
}
export const parseNativeCommandLeftEvent = (
  raw: unknown,
): NativeCommandLeftEvent => {
  const value = objectValue(raw);
  exactKeys(value, [
    'phase',
    'gesture',
    'serial',
    'epoch',
    'meta',
    'shift',
    'alt',
    'control',
  ]);
  return {
    phase: enumValue(value.phase, ['down', 'up', 'cancel']),
    gesture: integerValue(value.gesture, 1),
    serial: integerValue(value.serial, 1),
    epoch: integerValue(value.epoch, 1),
    meta: booleanValue(value.meta),
    shift: booleanValue(value.shift),
    alt: booleanValue(value.alt),
    control: booleanValue(value.control),
  };
};
