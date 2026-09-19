import type { IEventDetectionWindowAPI } from '../../../../types/ipc/eventDetectionWindow';

export const getEventDetectionWindowAPI = ():
  | IEventDetectionWindowAPI
  | undefined => window.electronAPI?.eventDetectionWindow;
