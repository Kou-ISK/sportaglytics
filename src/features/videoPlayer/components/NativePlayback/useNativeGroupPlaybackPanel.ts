import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CachePlayerRegistration } from '../PlaybackCache/CachePlayerContext';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import { parseNativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import type { NativeGroupTimeline } from '../../shared/nativePlayback/nativeGroupTimeline';
import { nativeGroupTimelineMatches } from '../../shared/nativePlayback/nativeGroupTimeline';
import { openQualifiedNativeGroupPlayback } from '../../shared/nativePlayback/nativeGroupPlaybackGateway';
import { useNativePlaybackState } from '../../shared/nativePlayback/useNativePlaybackState';
import { nativeStartUnavailableReason } from '../../shared/nativePlayback/nativeStartAvailability';
import type {
  NativePlaybackController,
  NativePlaybackControls,
} from '../../shared/nativePlayback/nativePlaybackController';
import type { NativePlaybackPanelViewProps } from './NativePlaybackPanelView';

const subscribeVisibility = (listener: () => void): (() => void) => {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
};
const isDocumentVisible = (): boolean => document.visibilityState === 'visible';
const notVisible = (): boolean => false;

export const useNativeGroupPlaybackPanel = (
  timeline: NativeGroupTimeline,
  playing: boolean,
  time: number,
  pause: () => void,
  restored: (time: number, controls: NativePlaybackControls) => void,
  surfaces: {
    ready: boolean;
    assertCurrent: () => void;
    hasPresented: (generation: string) => boolean;
  },
): {
  register: (player: CachePlayerRegistration) => () => void;
  view: NativePlaybackPanelViewProps | null;
  warning: string | null;
} => {
  const visible = useSyncExternalStore(
    subscribeVisibility,
    isDocumentVisible,
    notVisible,
  );
  const players = useRef(new Set<CachePlayerRegistration>());
  const [revision, setRevision] = useState(0);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [qualification, setQualification] = useState<{
    key: string;
    members: CachePlayerRegistration[];
    value: NativePlaybackAvailability;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(new WeakSet<CachePlayerRegistration>());
  const visibilityRecovery = useRef(new WeakSet<NativePlaybackController>());
  const { controller, state } = useNativePlaybackState();
  const current = useRef({ timeline, time, pause, restored, surfaces });
  current.current = { timeline, time, pause, restored, surfaces };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const register = useCallback(
    (player: CachePlayerRegistration): (() => void) => {
      players.current.add(player);
      setRevision((v) => v + 1);
      const changed = (): void => setSettingsRevision((v) => v + 1);
      const events = [
        'volumechange',
        'ratechange',
        'seeked',
        'loadeddata',
        'pause',
      ];
      events.forEach((event) => player.port.on(event, changed));
      return () => {
        players.current.delete(player);
        events.forEach((event) => player.port.off(event, changed));
        setRevision((v) => v + 1);
      };
    },
    [],
  );
  const members = timeline.slots.map((slot) =>
    [...players.current].filter(
      (player) =>
        player.playerId === slot.playerId && player.source === slot.sourceUrl,
    ),
  );
  const pair =
    players.current.size === 2 && members.every((values) => values.length === 1)
      ? [members[0][0], members[1][0]]
      : null;
  let audioIndex = -1;
  try {
    const audible =
      pair?.filter((player) => {
        const settings = player.port.settings();
        return !settings.muted && settings.volume > 0;
      }) ?? [];
    if (pair && audible.length <= 1)
      audioIndex = audible.length ? pair.indexOf(audible[0]) : 0;
  } catch {
    // A disposed original cannot authorize a new group; React cleanup may be pending.
  }
  const audioId = audioIndex >= 0 ? timeline.slots[audioIndex].angleId : null;
  useEffect(() => {
    const inspect = window.electronAPI?.nativePlayback.inspectGroup;
    if (
      !inspect ||
      !visible ||
      !surfaces.ready ||
      !pair ||
      audioId === null ||
      controller ||
      attempted.current.has(pair[0])
    )
      return;
    let cancelled = false;
    const captured = pair;
    setQualification(null);
    void inspect({
      angleIds: [timeline.slots[0].angleId, timeline.slots[1].angleId],
      audioAngleId: audioId,
    })
      .then((raw) => {
        const value = parseNativePlaybackAvailability(raw);
        if (
          !cancelled &&
          value.group &&
          value.group.audioAngleId === audioId &&
          nativeGroupTimelineMatches(timeline, value.group)
        )
          setQualification({ key: timeline.key, members: captured, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Member changes are represented by registration revision, audio by its ID.
  }, [timeline.key, revision, audioId, surfaces.ready, controller, visible]);
  useEffect(() => {
    if (
      controller ||
      !visible ||
      playing ||
      !surfaces.ready ||
      !qualification ||
      qualification.key !== timeline.key ||
      !pair ||
      qualification.members.some((member, index) => member !== pair[index]) ||
      attempted.current.has(pair[0])
    )
      return;
    const fresh = qualification.value,
      group = fresh.group;
    if (
      !fresh.available ||
      !fresh.presentation ||
      !group ||
      group.audioAngleId !== audioId
    )
      return;
    const audio =
      pair[
        timeline.slots.findIndex((slot) => slot.angleId === group.audioAngleId)
      ];
    try {
      if (
        !audio ||
        pair.some(
          (player) =>
            !player.port.paused() ||
            player.port.seeking() ||
            player.port.ready() < 2,
        ) ||
        nativeStartUnavailableReason(
          fresh.presentation,
          time,
          audio.port.settings(),
          false,
        )
      )
        return;
    } catch {
      return;
    }
    const captured = pair;
    const assertCurrent = (): void => {
      if (
        !alive.current ||
        current.current.timeline.key !== qualification.key ||
        players.current.size !== 2 ||
        captured.some((member) => !players.current.has(member))
      )
        throw Error('NATIVE_GROUP_PLAYER_CHANGED');
      current.current.surfaces.assertCurrent();
    };
    try {
      assertCurrent();
      attempted.current.add(captured[0]);
      const ports = new Map(
        timeline.slots.map((slot, index) => [
          slot.angleId,
          captured[index].port,
        ]),
      );
      openQualifiedNativeGroupPlayback(
        fresh,
        ports,
        time,
        () => current.current.pause(),
        assertCurrent,
        (t, c) => current.current.restored(t, c),
      );
    } catch {
      setError('標準再生を開始できなかったため、互換再生を使用します。');
    }
  }, [
    controller,
    visible,
    playing,
    surfaces.ready,
    qualification,
    timeline.key,
    revision,
    settingsRevision,
    time,
    audioId,
  ]);
  useEffect(() => {
    if (
      visible ||
      !controller ||
      !qualification ||
      (state.phase !== 'opening' && state.phase !== 'active') ||
      surfaces.hasPresented(controller.owner.generation) ||
      visibilityRecovery.current.has(controller)
    )
      return;
    // A transiently visible opening window may become occluded before its first
    // pair. Drain normally instead of waiting for a throttled rAF to time out.
    // Never reuse the native grant or reset an uncertain recovery attempt.
    visibilityRecovery.current.add(controller);
    const captured = qualification;
    current.current.pause();
    void controller
      .returnToOriginal()
      .then(() => {
        if (
          !alive.current ||
          current.current.timeline.key !== captured.key ||
          captured.members.some((member) => !players.current.has(member))
        )
          return;
        attempted.current.delete(captured.members[0]);
        setQualification(null);
        setRevision((value) => value + 1);
      })
      .catch(() => {
        if (alive.current)
          setError('両映像の復帰を確認できません。停止状態を保持しています。');
      });
  }, [visible, controller, qualification, state.phase, surfaces.hasPresented]);
  const onOriginal = useCallback((): void => {
    current.current.pause();
    controller?.finishPreview();
    void controller?.returnToOriginal().catch(() => {
      if (alive.current)
        setError('両映像の復帰を確認できません。停止状態を保持しています。');
    });
  }, [controller]);
  const controls = controller?.requestedControls;
  const fresh = qualification?.value;
  const view: NativePlaybackPanelViewProps | null =
    controller && fresh?.presentation
      ? {
          mode:
            state.phase === 'failed'
              ? 'failed'
              : state.phase === 'closing'
                ? 'restoring'
                : 'native',
          error:
            error ??
            (state.error ? '両映像の復帰を確認するまで停止しています。' : null),
          audioTracks: fresh.presentation.audioTracks,
          audioTrack: controls?.audioTrack ?? 0,
          muted: controls?.muted ?? true,
          onOriginal,
          onAudio: (track) => controller.controls({ audioTrack: track }),
          onMute: () => controller.controls({ muted: !controls?.muted }),
        }
      : null;
  return { register, view, warning: controller ? null : error };
};
