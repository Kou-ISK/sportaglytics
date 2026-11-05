import { useEffect, useRef } from 'react';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';
import { findMatchingHotkey, shouldIgnoreHotkeyTarget, sortHotkeysBySpecificity } from '../../../../hooks/globalHotkeyUtils';
import { createCommandGestureAdapter } from '../../shared/nativePlayback/commandGestureAdapter';
import { getNativePlayback, subscribeNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import type { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import type { NativeCommandLeftEvent } from '../../../../types/ipc/nativeCommandLeft';

/** Switches only an armed, native-capable Command+Left gesture away from DOM. */
export const useNativeCommandLeft = (
  hotkeys: HotkeyConfig[],
  onControls: (playing: boolean, rate: number) => void,
  onFailure: () => void,
): void => {
  const controlsRef = useRef(onControls); controlsRef.current = onControls;
  const failureRef = useRef(onFailure); failureRef.current = onFailure;
  useEffect(() => {
    const api = globalThis.window.electronAPI?.nativeCommandLeft;
    if (!api) return;
    const sorted = sortHotkeysBySpecificity(hotkeys);
    let mounted = true, fault = false, unavailable = false, arming = false, ticket = 0;
    let active: ReturnType<typeof createCommandGestureAdapter> | null = null;
    let activeEpoch = 0;
    let owner: NativePlaybackController | null = null;
    let transition: Promise<void> = Promise.resolve();
    let unsubscribeController = (): void => {};
    let watched: NativePlaybackController | null = null;
    let suppressRelease = false;
    let buffered: NativeCommandLeftEvent[] = [];
    const ignored = new Set<number>();
    const fail = (): void => { if (fault) return; fault = true; cancel(); failureRef.current(); };
    const cancel = (): void => {
      ticket++;
      const old = active; const oldOwner = owner; const oldEpoch = activeEpoch;
      const epochs = [...new Set(buffered.map((event) => event.epoch))].filter((epoch) => epoch !== oldEpoch);
      buffered = [];
      active = null; activeEpoch = 0; owner = null; ignored.clear();
      oldOwner?.interruptCommandGesture();
      const work = [
        ...(old ? [old.cancel()] : []),
        ...epochs.map((epoch) => createCommandGestureAdapter({ api, epoch, current: getNativePlayback,
          onControls: () => {}, onFailure: fail }).cancel()),
      ];
      for (const result of work) void result.catch(() => {});
      if (work.length) transition = transition.then(() => Promise.all(work)).then(() => { if (mounted && !fault) refresh(); }).catch(() => { fail(); });
    };
    const refresh = (): void => {
      const next = getNativePlayback();
      if (next !== watched) {
        unsubscribeController(); watched = next;
        unsubscribeController = next?.subscribe(refresh) ?? (() => {});
      }
      if (!mounted || fault || unavailable || !document.hasFocus() || !next?.supportsReverse(6)) {
        if (active || arming) cancel();
        return;
      }
      if (active && owner !== next) cancel();
      if (active || arming) return;
      if (next.requestedControls.playing && next.requestedControls.rate < 0) return;
      arming = true; const attempt = ++ticket;
      void (async () => {
        await transition;
        if (!mounted || fault || attempt !== ticket || !document.hasFocus() || getNativePlayback() !== next || !next.supportsReverse(6) ||
            (next.requestedControls.playing && next.requestedControls.rate < 0)) return;
        let epoch: number | null;
        try { epoch = await api.ready(); } catch { unavailable = true; return; }
        if (epoch === null) return;
        const candidate = createCommandGestureAdapter({ api, epoch, current: getNativePlayback,
          onControls: (playing, rate) => controlsRef.current(playing, rate), onFailure: fail });
        if (!mounted || fault || attempt !== ticket || !document.hasFocus() || getNativePlayback() !== next || !next.supportsReverse(6) ||
            (next.requestedControls.playing && next.requestedControls.rate < 0)) {
          await candidate.cancel(); return;
        }
        owner = next; activeEpoch = epoch; active = candidate;
        const events = buffered; buffered = [];
        for (const event of events) if (event.epoch === epoch && !accept(event)) { cancel(); fail(); break; }
      })().catch(fail).finally(() => { arming = false; if (mounted && !active && !fault && !unavailable && attempt !== ticket) refresh(); });
    };
    const accept = (event: NativeCommandLeftEvent): boolean => {
      if (!active || event.epoch !== activeEpoch) return false;
      if (event.phase === 'down') {
        const matched = findMatchingHotkey({ key: 'ArrowLeft', code: 'ArrowLeft',
          metaKey: event.meta, ctrlKey: event.control, shiftKey: event.shift, altKey: event.alt }, sorted);
        if (matched?.id !== 'reverse-playback-6x' || shouldIgnoreHotkeyTarget(document.activeElement)) {
          ignored.add(event.gesture); return true;
        }
        suppressRelease = true;
      } else if (ignored.delete(event.gesture)) {
        void api.retire(event.gesture, event.epoch).then((ok) => { if (!ok) { cancel(); fail(); } }).catch(() => { cancel(); fail(); });
        return true;
      }
      return active.receive(event);
    };
    const unsubscribeEvent = api.onEvent((event) => {
      if (!event) { cancel(); fail(); return false; }
      if (active) return event.epoch !== activeEpoch || accept(event);
      if (mounted && !fault && arming && buffered.length < 64) { buffered.push(event); return true; }
      return false;
    });
    const unsubscribeOverflow = api.onOverflow((epoch) => { if (epoch === null || epoch === activeEpoch) { cancel(); fail(); } });
    const down = (event: KeyboardEvent): void => {
      if (active && !shouldIgnoreHotkeyTarget(event.target) && event.key === 'ArrowLeft' && event.metaKey && findMatchingHotkey(event, sorted)?.id === 'reverse-playback-6x') {
        suppressRelease = true; event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.key !== 'Meta') { suppressRelease = false; if (active) cancel(); }
    };
    const up = (event: KeyboardEvent): void => {
      if (!suppressRelease) return;
      if (event.key === 'ArrowLeft' || event.key === 'Meta') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Meta') suppressRelease = false;
      }
    };
    const blur = (): void => { suppressRelease = false; cancel(); };
    const focus = (): void => { refresh(); };
    const pointer = (): void => { if (active) cancel(); };
    const unsubscribeOwner = subscribeNativePlayback(refresh);
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    window.addEventListener('pointerdown', pointer, true);
    refresh();
    return () => {
      mounted = false; unsubscribeOwner(); unsubscribeController(); unsubscribeEvent(); unsubscribeOverflow();
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      window.removeEventListener('pointerdown', pointer, true); cancel();
    };
  }, [hotkeys]);
};
