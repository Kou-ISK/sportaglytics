import videojs from 'video.js';

export interface VideoJsPlayerHandle {
  el?: () => Element | null;
  isDisposed?: () => boolean;
  error?: () => unknown;
  duration?: () => number | undefined;
  currentTime?: (time?: number) => number | void | undefined;
  readyState?: () => number;
  play?: () => Promise<void> | void;
  pause?: () => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  muted?: (value: boolean) => void;
  ready?: (callback: () => void) => void;
}

const isObjectLike = (value: unknown): value is object => {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
};

const getMethod = <TArgs extends unknown[], TResult>(
  target: unknown,
  key: string,
): ((...args: TArgs) => TResult) | undefined => {
  if (!isObjectLike(target)) {
    return undefined;
  }

  const candidate = Reflect.get(target, key);
  return typeof candidate === 'function'
    ? (candidate as (...args: TArgs) => TResult)
    : undefined;
};

const isVideoJsPlayerHandle = (value: unknown): value is VideoJsPlayerHandle => {
  if (!isObjectLike(value)) {
    return false;
  }

  return (
    getMethod(value, 'currentTime') !== undefined ||
    getMethod(value, 'play') !== undefined ||
    getMethod(value, 'pause') !== undefined
  );
};

export const getVideoJsPlayer = (
  id: string,
): VideoJsPlayerHandle | undefined => {
  const getPlayer = getMethod<[string], unknown>(videojs, 'getPlayer');
  if (!getPlayer) {
    return undefined;
  }

  const player = getPlayer(id);
  if (!isVideoJsPlayerHandle(player) || player.isDisposed?.()) {
    return undefined;
  }

  return player;
};

export const getVideoJsPlayerCurrentTime = (
  idOrPlayer: string | VideoJsPlayerHandle,
): number | null => {
  const player =
    typeof idOrPlayer === 'string' ? getVideoJsPlayer(idOrPlayer) : idOrPlayer;
  const currentTime = player?.currentTime?.();
  return typeof currentTime === 'number' && !Number.isNaN(currentTime)
    ? currentTime
    : null;
};

export const setVideoJsPlayerCurrentTime = (
  idOrPlayer: string | VideoJsPlayerHandle,
  time: number,
): boolean => {
  const player =
    typeof idOrPlayer === 'string' ? getVideoJsPlayer(idOrPlayer) : idOrPlayer;
  if (!player?.currentTime) {
    return false;
  }

  try {
    player.currentTime(time);
    return true;
  } catch {
    return false;
  }
};
