import { useEffect, useRef } from 'react';
import type { EventDetectionWindowState } from '../../../../types/ipc/eventDetectionWindow';
import type { EventDetectionPanelViewProps } from '../components/EventDetectionPanelView';
import { subscribeEventDetectionOpenRequest } from '../gateway/eventDetectionGateway';
import { getEventDetectionWindowAPI } from '../gateway/eventDetectionWindowGateway';

/** Keep inference and timeline mutations in the package's owner renderer. */
export const useEventDetectionWindowHost = (
  props: EventDetectionPanelViewProps,
): void => {
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const api = getEventDetectionWindowAPI();
    if (!api) return;
    const offOpen = subscribeEventDetectionOpenRequest(() => {
      void api.open();
    });
    const offCommand = api.onCommand((command) => {
      const current = latest.current;
      switch (command.type) {
        case 'run':
          current.onRun();
          break;
        case 'cancel':
          current.onCancel();
          break;
        case 'close':
          current.onClose();
          break;
        case 'model':
          current.onModelChange(command.key);
          break;
        case 'angle':
          current.onAngleChange(command.id);
          break;
        case 'mapping':
          current.onMappingChange(command.eventType, command.updates);
          break;
      }
    });
    return () => {
      offOpen();
      offCommand();
      api.publish(null);
    };
  }, []);
  const {
    open,
    loadingModels,
    models,
    selectedModelKey,
    angleOptions,
    selectedAngleId,
    mappings,
    progress,
    running,
    error,
    summary,
  } = props;
  useEffect(() => {
    const snapshot: EventDetectionWindowState = {
      open,
      loadingModels,
      models,
      selectedModelKey,
      angleOptions,
      selectedAngleId,
      mappings,
      progress,
      running,
      error: error?.slice(0, 4096) ?? null,
      summary,
    };
    getEventDetectionWindowAPI()?.publish(snapshot);
  }, [
    open,
    loadingModels,
    models,
    selectedModelKey,
    angleOptions,
    selectedAngleId,
    mappings,
    progress,
    running,
    error,
    summary,
  ]);
};
