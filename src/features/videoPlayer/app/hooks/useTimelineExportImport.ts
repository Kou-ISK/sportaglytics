import { useEffect, useRef } from 'react';
import type { TimelineData } from '../../../../types/TimelineData';
import {
  readTimelineFile,
  requestTimelineExportPath,
  requestTimelineImportPath,
  subscribeTimelineExportRequest,
  subscribeTimelineImportRequest,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';
import {
  buildTimelineExportPlan,
  parseTimelineImportContent,
} from '../utils/timelineImportExportService';
import { useNotification } from '../../../../contexts/NotificationContext';

interface UseTimelineExportImportParams {
  timeline: TimelineData[];
  setTimeline: (timeline: TimelineData[]) => void;
}

export const useTimelineExportImport = ({
  timeline,
  setTimeline,
}: UseTimelineExportImportParams): void => {
  const { success, error: showError } = useNotification();
  const timelineRef = useRef(timeline);
  const setTimelineRef = useRef(setTimeline);
  const successRef = useRef(success);
  const showErrorRef = useRef(showError);

  timelineRef.current = timeline;
  setTimelineRef.current = setTimeline;
  successRef.current = success;
  showErrorRef.current = showError;

  useEffect(() => {
    const handleExport = async (format: string) => {
      const currentTimeline = timelineRef.current;
      if (currentTimeline.length === 0) {
        showErrorRef.current('エクスポートするタイムラインがありません');
        return;
      }

      try {
        const exportPlan = buildTimelineExportPlan(format, currentTimeline);
        if (!exportPlan) {
          showErrorRef.current('未対応の形式です');
          return;
        }

        const filePath = await requestTimelineExportPath(
          exportPlan.defaultFileName,
          exportPlan.filters,
        );
        if (!filePath) {
          return;
        }

        const writeSuccess = await writeTimelineFile(filePath, exportPlan.content);

        if (writeSuccess) {
          successRef.current(
            `タイムラインを${exportPlan.formatLabel}でエクスポートしました`,
          );
        } else {
          showErrorRef.current('ファイルの保存に失敗しました');
        }
      } catch (error: unknown) {
        console.error('Export error:', error);
        showErrorRef.current(
          `エクスポートに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const handleImport = async () => {
      try {
        const filePath = await requestTimelineImportPath();
        if (!filePath) {
          return;
        }

        const content = await readTimelineFile(filePath);
        if (!content) {
          showErrorRef.current('ファイルの読み込みに失敗しました');
          return;
        }

        const imported = parseTimelineImportContent(content);
        setTimelineRef.current(imported.timeline);
        successRef.current(imported.message);
      } catch (error: unknown) {
        console.error('Import error:', error);
        showErrorRef.current(
          `インポートに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const unsubscribeExport = subscribeTimelineExportRequest(handleExport);
    const unsubscribeImport = subscribeTimelineImportRequest(handleImport);

    return () => {
      unsubscribeExport();
      unsubscribeImport();
    };
  }, []);
};
