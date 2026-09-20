import { videoGridAspect } from './videoGridAspect';
import { useEffect } from 'react';
import type { RefObject } from 'react';

/** 映像以外のペインを除外し、OSウィンドウのリサイズ比率を更新する。 */
export const useVideoWindowAspect = (
  rootRef: RefObject<HTMLElement | null>,
  layoutKey: string,
  ratio?: number,
): void => {
  useEffect(() => {
    const root = rootRef.current;
    const update = window.electronAPI?.setVideoWindowAspect;
    if (!root || !update) return;
    let timer: ReturnType<typeof setTimeout>;
    let previous = '';
    const media =
      root.querySelector<HTMLElement>('[data-video-aspect-surface]') ?? root;
    const measure = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const visible = Array.from(media.querySelectorAll('video')).filter(
          (video) => {
            if (!video.videoWidth || video.clientWidth < 2) return false;
            for (
              let node: HTMLElement | null = video;
              node && node !== media;
              node = node.parentElement
            ) {
              const style = getComputedStyle(node);
              if (style.opacity === '0' || style.display === 'none')
                return false;
            }
            return true;
          },
        );
        const ratios = visible.map(
          (video) => video.videoWidth / video.videoHeight,
        );
        if (!ratios.length && ratio === undefined) {
          previous = '';
          update(null);
          return;
        }
        const aspectRatio = ratio ?? videoGridAspect(ratios);
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
        const rect = media.getBoundingClientRect();
        const value = {
          aspectRatio,
          width: Math.max(0, Math.round(innerWidth - rect.width)),
          height: Math.max(0, Math.round(innerHeight - rect.height)),
        };
        const key = JSON.stringify(value);
        // Programmatic resizes (including restoring window bounds) can bypass
        // the OS aspect lock without changing the measured chrome dimensions.
        const needsFit =
          rect.height > 0 &&
          Math.abs(rect.height - rect.width / aspectRatio) > 1;
        if (key !== previous || needsFit) {
          previous = key;
          update(value);
        }
      }, 100);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(media);
    root.addEventListener('loadedmetadata', measure, true);
    root.addEventListener('emptied', measure, true);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener('loadedmetadata', measure, true);
      root.removeEventListener('emptied', measure, true);
      window.removeEventListener('resize', measure);
      update(null);
    };
  }, [rootRef, layoutKey, ratio]);
};
