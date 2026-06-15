import type { IpcRenderer, IpcRendererEvent } from 'electron';

export type ListenerStore = Map<
  string,
  Map<object, (...args: unknown[]) => void>
>;

export const createListenerStore = (): ListenerStore => new Map();

export type RegisterListener = <T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void,
) => () => void;

export const createRegisterListener = (
  ipcRenderer: IpcRenderer,
  listenerStore: ListenerStore,
): RegisterListener => {
  return <T extends unknown[]>(
    channel: string,
    callback: (...args: T) => void,
  ): (() => void) => {
    const wrapped = (...rawArgs: unknown[]) => {
      const [, ...args] = rawArgs as [IpcRendererEvent, ...unknown[]];
      callback(...(args as T));
    };

    let map = listenerStore.get(channel);
    if (!map) {
      map = new Map();
      listenerStore.set(channel, map);
    }

    map.set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);

    return () => {
      ipcRenderer.removeListener(channel, wrapped);
      map?.delete(callback);
      if (map && map.size === 0) {
        listenerStore.delete(channel);
      }
    };
  };
};

export const setMappedListener = (
  listenerStore: ListenerStore,
  channel: string,
  callback: object,
  wrapped: (...args: unknown[]) => void,
): void => {
  let map = listenerStore.get(channel);
  if (!map) {
    map = new Map();
    listenerStore.set(channel, map);
  }
  map.set(callback, wrapped);
};

export const getMappedListener = (
  listenerStore: ListenerStore,
  channel: string,
  callback: object,
): ((...args: unknown[]) => void) | undefined => {
  return listenerStore.get(channel)?.get(callback);
};

export const removeMappedListener = (
  listenerStore: ListenerStore,
  channel: string,
  callback: object,
): void => {
  const map = listenerStore.get(channel);
  if (!map) {
    return;
  }

  map.delete(callback);
  if (map.size === 0) {
    listenerStore.delete(channel);
  }
};
