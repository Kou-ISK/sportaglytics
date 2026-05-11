import { useCallback, useEffect } from 'react';
import type { TimelineData } from '../../../../types/timeline/core';
import { useNotification } from '../../../../contexts/NotificationContext';
import { exportRawAnalysisCsv } from '../../../../utils/analysisExport';
import {
  saveRawTimelineCsv,
  subscribeRawTimelineCsvExportRequest,
} from '../gateways/rawTimelineCsvExportGateway';

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

    const csv = exportRawAnalysisCsv(timeline);
    const result = await saveRawTimelineCsv(
      buildDefaultFileName(),
      [{ name: 'CSV (Raw)', extensions: ['csv'] }],
      csv,
    );

    if (result === 'saved') {
      notification.success('Raw CSVを保存しました。');
      return;
    }
    if (result === 'cancelled') {
      return;
    }

    notification.error(
      result === 'unavailable'
        ? 'Raw CSVエクスポート機能が利用できません。'
        : 'Raw CSV保存に失敗しました。',
    );
  }, [notification, timeline]);

  useEffect(() => {
    return subscribeRawTimelineCsvExportRequest(() => {
      void exportRawCsv();
    });
  }, [exportRawCsv]);

  return { exportRawCsv };
};
