import type { HotkeyConfig } from '../../../../../types/settings/coreTypes';
import { useMemo } from 'react';
import type {
  AngleSyncCommand,
  AngleSyncSnapshot,
} from '../../../../../types/ipc/angleSync';
import { useAngleSyncDraft } from './useAngleSyncDraft';
import type { AngleSyncParams } from './useAngleSyncDraft';
import { useAngleSyncTransport } from './useAngleSyncTransport';
import { useAngleSyncHotkeys } from './useAngleSyncHotkeys';
import {
  angleSyncBounds,
  resolveAngleSyncTime,
  syncPointTime,
} from './angleSync';

export const useAngleSyncSession = (
  props: AngleSyncParams,
  enabled: boolean,
  hotkeys: HotkeyConfig[],
  initialAngle: number | null,
): {
  controller: ReturnType<typeof useAngleSyncDraft>;
  transport: ReturnType<typeof useAngleSyncTransport>;
  snapshot: AngleSyncSnapshot | undefined;
  currentTime: number;
  maxSec: number;
  command: (command: AngleSyncCommand) => void;
} => {
  const controller = useAngleSyncDraft(props, enabled);
  const transport = useAngleSyncTransport(
    controller,
    props.initialTime,
    enabled,
    initialAngle,
  );
  const { draft, points } = controller;
  const index = transport.selected ?? 0;
  const time = transport.times[index] ?? props.initialTime;
  const angle = draft.angles[index];
  const canMark =
    transport.selected !== null &&
    !!angle &&
    !!resolveAngleSyncTime(angle, draft.offsets[index] ?? 0, time);
  const snapshot = useMemo<AngleSyncSnapshot | undefined>(
    () =>
      enabled
        ? {
            angles: draft.angles.map((item, i) => ({
              name: item.name,
              point: syncPointTime(
                item,
                draft.offsets[i] ?? 0,
                points[item.id],
              ),
            })),
            selected: transport.selected,
            busy: controller.busy || transport.stepping,
            saving: controller.saving,
            analyzing: controller.analyzing,
            changed: controller.changed,
            canMark,
            canAlign:
              draft.angles.length > 1 &&
              draft.angles.every((item) => points[item.id]),
            frameAvailable: angle?.sourceKind === 'local',
            message: controller.message,
          }
        : undefined,
    [
      enabled,
      draft,
      points,
      transport.selected,
      transport.stepping,
      controller.busy,
      controller.saving,
      controller.analyzing,
      controller.changed,
      controller.message,
      angle,
      canMark,
    ],
  );
  const command = (value: AngleSyncCommand): void => {
    if (!enabled) return;
    if (value.action === 'cancel') {
      controller.cancel();
      return;
    }
    if (controller.busy) return;
    switch (value.action) {
      case 'select':
        transport.select(value.index);
        break;
      case 'step':
        void transport.step(value.direction);
        break;
      case 'skip':
        transport.seek(time + value.seconds);
        break;
      case 'toggle':
        transport.toggle();
        break;
      case 'mark':
        void transport.mark();
        break;
      case 'align':
        transport.align();
        break;
      case 'remove-point':
        if (transport.selected !== null)
          controller.removePoint(transport.selected);
        break;
      case 'save':
        transport.pause();
        void controller.save();
        break;
      case 'reset':
        transport.pause();
        controller.reset();
        break;
      case 'audio':
        transport.pause();
        void controller.refineAudio();
        break;
    }
  };
  useAngleSyncHotkeys(enabled, command, hotkeys);
  return {
    controller,
    transport,
    snapshot,
    command,
    currentTime: time,
    maxSec: Math.max(
      0,
      ...draft.angles.map(
        (item, i) => angleSyncBounds(item, draft.offsets[i] ?? 0).end,
      ),
    ),
  };
};

export type AngleSyncSession = ReturnType<typeof useAngleSyncSession>;
