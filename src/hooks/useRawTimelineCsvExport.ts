import { useCallback, useEffect } from 'react';
import type { TimelineData } from '../types/TimelineData';
import { useNotification } from '../contexts/NotificationContext';
import { exportRawAnalysisCsv } from '../utils/analysisExport';

interface UseRawTimelineCsvExportParams {
  timeline: TimelineData[];
}

const buildDefaultFileName = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `timeline-raw-${date}.csv`;
};

export const useRawTimelineCsvExport = ({
  timeline,
}: UseRawTimelineCsvExportParams) => {
  const notification = useNotification();

  const exportRawCsv = useCallback(async () => {
    if (timeline.length === 0) {
      notification.warning('エクスポート対象のタイムラインがありません。');
      return;
    }

    const api = globalThis.window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeTextFile) {
      notification.error('Raw CSVエクスポート機能が利用できません。');
      return;
    }

    const filePath = await api.saveFileDialog(buildDefaultFileName(), [
      { name: 'CSV (Raw)', extensions: ['csv'] },
    ]);

    if (!filePath) return;

    const csv = exportRawAnalysisCsv(timeline);
    const ok = await api.writeTextFile(filePath, csv);

    if (ok) {
      notification.success('Raw CSVを保存しました。');
    } else {
      notification.error('Raw CSV保存に失敗しました。');
    }
  }, [notification, timeline]);

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.on) return;

    const handler = () => {
      void exportRawCsv();
    };

    api.on('menu-export-analysis-raw-csv', handler);
    return () => {
      api.off?.('menu-export-analysis-raw-csv', handler);
    };
  }, [exportRawCsv]);

  return { exportRawCsv };
};
