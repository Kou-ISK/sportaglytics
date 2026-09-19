import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import type { EventDetectionWindowState } from '../../../types/ipc/eventDetectionWindow';
import { EventDetectionPanelView } from './components/EventDetectionPanelView';
import { getEventDetectionWindowAPI } from './gateway/eventDetectionWindowGateway';

export const EventDetectionWindowScreen = (): JSX.Element => {
  const [state, setState] = useState<EventDetectionWindowState | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const api = getEventDetectionWindowAPI();
    if (!api) {
      setError(true);
      return;
    }
    let active = true;
    let updated = false;
    const unsubscribe = api.onState((next) => {
      updated = true;
      if (active) setState(next);
    });
    void api
      .requestState()
      .then((initial) => {
        if (active && !updated) setState(initial);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  if (error)
    return (
      <Alert severity="error">
        解析画面に接続できませんでした。映像ウィンドウから開き直してください。
      </Alert>
    );
  if (!state)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <CircularProgress aria-label="解析設定を読み込み中" />
      </Box>
    );
  const api = getEventDetectionWindowAPI();
  return (
    <EventDetectionPanelView
      {...state}
      onClose={() => {
        if (state.running) void api?.hide();
        else api?.command({ type: 'close' });
      }}
      onRun={() => api?.command({ type: 'run' })}
      onCancel={() => api?.command({ type: 'cancel' })}
      onModelChange={(key) => api?.command({ type: 'model', key })}
      onAngleChange={(id) => api?.command({ type: 'angle', id })}
      onMappingChange={(eventType, updates) =>
        api?.command({ type: 'mapping', eventType, updates })
      }
    />
  );
};
