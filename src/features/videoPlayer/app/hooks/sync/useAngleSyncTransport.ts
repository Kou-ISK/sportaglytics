import { useCallback, useEffect, useRef, useState } from 'react';
import { getVideoJsPlayerCurrentTime } from '../../../shared/videojs/videoJsAdapter';
import { adjacentSyncFrame } from './angleSyncFrames';
import { angleSyncBounds, resolveAngleSyncTime } from './angleSync';
import type { useAngleSyncDraft } from './useAngleSyncDraft';
import type { AnglePreviewStatus } from './useAngleSyncPreview';

type DraftController = ReturnType<typeof useAngleSyncDraft>;

export const useAngleSyncTransport = (
  controller: DraftController,
  initialTime: number,
  enabled = true,
): {
  selected: number | null;
  times: number[];
  playing: boolean;
  stepping: boolean;
  select: (index: number | null) => void;
  seek: (time: number) => void;
  toggle: () => void;
  step: (direction: -1 | 1) => Promise<void>;
  mark: () => Promise<void>;
  align: () => void;
  pause: () => void;
  onStatus: (index: number, status: AnglePreviewStatus) => void;
} => {
  const { draft } = controller;
  const [selected, setSelected] = useState<number | null>(null);
  const [times, setTimes] = useState(() => draft.angles.map(() => initialTime));
  const [playing, setPlaying] = useState(false);
  const [stepping, setStepping] = useState(false);
  const timesRef = useRef(times);
  timesRef.current = times;
  const status = useRef<Record<number, AnglePreviewStatus>>({});
  const generation = useRef(0);
  const framePending = useRef(false);
  const pause = (): void => {
    setPlaying(false);
  };
  const select = (index: number | null): void => {
    if (
      controller.busy ||
      (index !== null && (index < 0 || index >= draft.angles.length))
    )
      return;
    generation.current++;
    pause();
    setSelected(index === selected ? null : index);
  };
  const seek = (time: number): void => {
    if (!Number.isFinite(time) || controller.busy) return;
    generation.current++;
    pause();
    const next = timesRef.current.map((previous, index) => {
      if (selected !== null && selected !== index) return previous;
      const bounds = angleSyncBounds(
        draft.angles[index],
        draft.offsets[index] ?? 0,
      );
      // All-angle preview keeps a common clock even when an angle has ended.
      return selected === null
        ? time
        : Math.max(bounds.start, Math.min(time, bounds.end));
    });
    timesRef.current = next;
    setTimes(next);
  };
  const step = async (direction: -1 | 1): Promise<void> => {
    if (controller.busy || framePending.current || !draft.angles.length) return;
    pause();
    framePending.current = true;
    setStepping(true);
    const version = ++generation.current;
    const index = selected ?? 0;
    const angle = draft.angles[index];
    const offset = draft.offsets[index] ?? 0;
    const time = timesRef.current[index];
    const resolved = resolveAngleSyncTime(angle, offset, time);
    try {
      const api = window.electronAPI;
      if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
      const clips = [...angle.clips].sort(
        (a, b) => a.timelineStartSeconds - b.timelineStartSeconds,
      );
      let clip = resolved?.clip;
      let local = resolved?.sourceTime ?? 0;
      if (
        resolved &&
        status.current[index]?.clipId === resolved.clip.id &&
        status.current[index]?.ready
      )
        local = getVideoJsPlayerCurrentTime(`sync_angle_${index}`) ?? local;
      if (!clip) {
        clip =
          direction > 0
            ? clips.find((item) => item.timelineStartSeconds - offset > time)
            : [...clips]
                .reverse()
                .find((item) => item.timelineStartSeconds - offset < time);
        if (!clip) return;
        local = direction > 0 ? -0.001 : (clip.durationSeconds ?? 0);
      }
      if (/^https?:\/\//i.test(clip.source))
        throw new Error(
          'YouTubeは正確なコマ送りに対応していません。シークで同期点を合わせてください。',
        );
      const frames = await api.readMediaFrameWindow(
        clip.source,
        Math.max(0, local),
      );
      let target = resolved
        ? adjacentSyncFrame(frames.times, local, direction)
        : direction > 0
          ? frames.times[0]
          : frames.times.at(-1);
      if (target === undefined) {
        const next =
          clips[clips.findIndex((item) => item.id === clip?.id) + direction];
        if (!next) return;
        clip = next;
        const adjacent = await api.readMediaFrameWindow(
          next.source,
          direction > 0 ? 0 : Math.max(0, (next.durationSeconds ?? 0) - 0.001),
        );
        target = direction > 0 ? adjacent.times[0] : adjacent.times.at(-1);
      }
      if (target !== undefined && version === generation.current)
        seek(clip.timelineStartSeconds + target - offset + 0.0001);
    } catch (error) {
      if (version === generation.current)
        controller.setMessage(
          error instanceof Error && error.message.startsWith('YouTube')
            ? error.message
            : 'フレームを取得できませんでした。映像を確認して再試行してください。',
        );
    } finally {
      framePending.current = false;
      setStepping(false);
    }
  };
  const mark = async (): Promise<void> => {
    if (selected === null || controller.busy || framePending.current) return;
    pause();
    const angle = draft.angles[selected];
    const resolved = resolveAngleSyncTime(
      angle,
      draft.offsets[selected] ?? 0,
      timesRef.current[selected],
    );
    if (
      !resolved ||
      status.current[selected]?.clipId !== resolved.clip.id ||
      !status.current[selected]?.ready
    ) {
      controller.setMessage(
        '映像が表示されている位置に同期点を設定してください。',
      );
      return;
    }
    let time =
      getVideoJsPlayerCurrentTime(`sync_angle_${selected}`) ??
      resolved.sourceTime;
    const version = ++generation.current;
    framePending.current = true;
    setStepping(true);
    try {
      const api = window.electronAPI;
      if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
      if (!/^https?:\/\//i.test(resolved.clip.source)) {
        const frames = await api.readMediaFrameWindow(
          resolved.clip.source,
          time,
        );
        time =
          [...frames.times].reverse().find((value) => value <= time + 0.0005) ??
          time;
      }
      if (version === generation.current)
        controller.mark(selected, {
          clipId: resolved.clip.id,
          sourceTime: time,
        });
    } catch {
      controller.setMessage(
        '同期点のフレームを確認できませんでした。再試行してください。',
      );
    } finally {
      framePending.current = false;
      setStepping(false);
    }
  };
  const align = (): void => {
    pause();
    generation.current++;
    const time = controller.align();
    if (time !== null) {
      const next = draft.angles.map(() => time);
      timesRef.current = next;
      setTimes(next);
      setSelected(null);
    }
  };
  const toggle = (): void => {
    if (controller.busy || framePending.current || !draft.angles.length) return;
    if (!playing && selected === null) {
      const next = draft.angles.map(() => timesRef.current[0]);
      timesRef.current = next;
      setTimes(next);
    }
    setPlaying(!playing);
  };
  const current = useRef({
    controller,
    draft,
    selected,
    seek,
    step,
    mark,
    align,
    toggle,
    select,
  });
  current.current = {
    controller,
    draft,
    selected,
    seek,
    step,
    mark,
    align,
    toggle,
    select,
  };
  useEffect(() => {
    if (!enabled || !playing || controller.busy) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const state = current.current;
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = [...timesRef.current];
      const indices =
        state.selected === null
          ? state.draft.angles.map((_, i) => i)
          : [state.selected];
      const ready = indices.every((i) => {
        const resolved = resolveAngleSyncTime(
          state.draft.angles[i],
          state.draft.offsets[i] ?? 0,
          next[i],
        );
        return (
          !resolved ||
          (status.current[i]?.clipId === resolved.clip.id &&
            status.current[i]?.ready)
        );
      });
      if (ready) {
        const end = Math.max(
          ...indices.map(
            (i) =>
              angleSyncBounds(
                state.draft.angles[i],
                state.draft.offsets[i] ?? 0,
              ).end,
          ),
        );
        indices.forEach((i) => {
          next[i] = Math.min(end, next[i] + elapsed);
        });
        timesRef.current = next;
        setTimes(next);
        if (indices.every((i) => next[i] >= end)) setPlaying(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, playing, controller.busy]);
  const initialRef = useRef({ initialTime, count: draft.angles.length });
  initialRef.current = { initialTime, count: draft.angles.length };
  useEffect(() => {
    generation.current++;
    setPlaying(false);
    setSelected(null);
    const next = Array.from(
      { length: initialRef.current.count },
      () => initialRef.current.initialTime,
    );
    timesRef.current = next;
    setTimes(next);
    if (!enabled) return;
    const command = (): void => {
      void current.current.mark();
    };
    window.addEventListener('clip-sync-place', command);
    return () => {
      generation.current++;
      window.removeEventListener('clip-sync-place', command);
    };
  }, [enabled, draft.angles.length]);
  return {
    selected,
    times,
    playing,
    stepping,
    select,
    seek,
    toggle,
    step,
    mark,
    align,
    pause,
    onStatus: useCallback((index: number, value: AnglePreviewStatus): void => {
      status.current[index] = value;
    }, []),
  };
};
