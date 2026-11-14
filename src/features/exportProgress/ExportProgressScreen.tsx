import React, { useEffect, useState } from 'react';
import type { ExportProgressWindowState } from '../../types/ipc/exportProgressWindow';
import {
  cancelClipExport,
  closeExportProgressWindow,
  requestClipExportProgressWindowState,
  subscribeClipExportProgressWindowState,
} from '../../shared/clipExport/clipExportGateway';
import { ExportProgressView } from './ExportProgressView';

export const ExportProgressScreen = (): React.ReactElement => {
  const [state, setState] = useState<ExportProgressWindowState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; message: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeClipExportProgressWindowState(setState);
    void requestClipExportProgressWindowState().then((latest) => {
      if (active && latest)
        setState((current) =>
          current && current.updatedAt > latest.updatedAt ? current : latest,
        );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const cancel = (): void => {
    if (!state || state.status !== 'running' || pendingId === state.id) return;
    const id = state.id;
    setNotice(null);
    setPendingId(id);
    void cancelClipExport(id)
      .then((result) => {
        if (result === 'too-late')
          setNotice({
            id,
            message:
              '保存確定中です。残りの書き出しを中止する場合は、もう一度操作してください。',
          });
        else if (result === 'not-found')
          setNotice({
            id,
            message: 'この書き出しは終了したか、表示が切り替わりました。',
          });
      })
      .finally(() =>
        setPendingId((current) => (current === id ? null : current)),
      );
  };
  return (
    <ExportProgressView
      state={state}
      now={now}
      pending={state !== null && pendingId === state.id}
      notice={state && notice?.id === state.id ? notice.message : null}
      onCancel={cancel}
      onClose={closeExportProgressWindow}
    />
  );
};
