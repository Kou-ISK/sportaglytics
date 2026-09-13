import type { BrowserWindow, Event, Rectangle } from 'electron';

interface VideoAspect {
  aspectRatio: number;
  width: number;
  height: number;
}

/** Windows does not implement setAspectRatio's extraSize argument. */
export const resizeVideoBounds = (
  proposed: Rectangle,
  previous: Rectangle,
  extra: { width: number; height: number },
  aspectRatio: number,
  minimum: readonly number[],
  edge: string,
): Rectangle => {
  const heightDriven = edge === 'top' || edge === 'bottom';
  const videoWidth = Math.max(
    120,
    (minimum[0] ?? 0) - extra.width,
    ((minimum[1] ?? 0) - extra.height) * aspectRatio,
    heightDriven
      ? (proposed.height - extra.height) * aspectRatio
      : proposed.width - extra.width,
  );
  const width = Math.round(videoWidth + extra.width);
  const height = Math.round(videoWidth / aspectRatio + extra.height);
  return {
    x: edge.includes('left') ? previous.x + previous.width - width : proposed.x,
    y: edge.includes('top')
      ? previous.y + previous.height - height
      : proposed.y,
    width,
    height,
  };
};

const cleanups = new WeakMap<BrowserWindow, () => void>();

export const setVideoWindowAspect = (
  window: BrowserWindow,
  value: VideoAspect | null,
): void => {
  cleanups.get(window)?.();
  cleanups.delete(window);
  window.setAspectRatio(0);
  if (!value) return;
  if (process.platform !== 'win32') {
    window.setAspectRatio(value.aspectRatio, value);
    return;
  }

  const resize = (
    event: Event,
    bounds: Rectangle,
    details: { edge: string },
  ): void => {
    if (window.isDestroyed() || window.isMaximized() || window.isFullScreen())
      return;
    const previous = window.getBounds();
    const [contentWidth, contentHeight] = window.getContentSize();
    const next = resizeVideoBounds(
      bounds,
      previous,
      {
        width: previous.width - contentWidth + value.width,
        height: previous.height - contentHeight + value.height,
      },
      value.aspectRatio,
      window.getMinimumSize(),
      details.edge,
    );
    event.preventDefault();
    window.setBounds(next);
  };
  const cleanup = (): void => {
    window.removeListener('will-resize', resize);
    window.removeListener('closed', cleanup);
  };
  window.on('will-resize', resize);
  window.once('closed', cleanup);
  cleanups.set(window, cleanup);
};
