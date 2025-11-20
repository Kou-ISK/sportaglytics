import { useEffect } from 'react';
import type { TimelineData } from '../../../types/TimelineData';
import {
  exportToJSON,
  exportToCSV,
  importFromJSON,
} from '../../../utils/timelineExport';
import { useNotification } from '../../../contexts/NotificationContext';

interface UseTimelineExportImportParams {
  timeline: TimelineData[];
  setTimeline: (timeline: TimelineData[]) => void;
}

export const useTimelineExportImport = ({
  timeline,
  setTimeline,
}: UseTimelineExportImportParams) => {
  const { success, error: showError } = useNotification();

  useEffect(() => {
    const handleExport = async (format: string) => {
      if (!globalThis.window.electronAPI) return;

      if (timeline.length === 0) {
        showError('エクスポートするタイムラインがありません');
        return;
      }

      try {
        let content: string;
        let extension: string;
        let filterName: string;

        if (format === 'json') {
          content = exportToJSON(timeline);
          extension = 'json';
          filterName = 'JSON形式';
        } else if (format === 'csv') {
          content = exportToCSV(timeline);
          extension = 'csv';
          filterName = 'CSV形式';
        } else {
          showError('未対応の形式です');
          return;
        }

        const filePath = await globalThis.window.electronAPI.saveFileDialog(
          `timeline.${extension}`,
          [{ name: filterName, extensions: [extension] }],
        );

        if (!filePath) return; // キャンセル

        const writeSuccess = await globalThis.window.electronAPI.writeTextFile(
          filePath,
          content,
        );

        if (writeSuccess) {
          success(`タイムラインを${filterName}でエクスポートしました`);
        } else {
          showError('ファイルの保存に失敗しました');
        }
      } catch (err) {
        console.error('Export error:', err);
        showError(
          `エクスポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    const handleImport = async () => {
      if (!globalThis.window.electronAPI) return;

      try {
        const filePath = await globalThis.window.electronAPI.openFileDialog([
          { name: 'JSON形式', extensions: ['json'] },
        ]);

        if (!filePath) return; // キャンセル

        const content =
          await globalThis.window.electronAPI.readTextFile(filePath);

        if (!content) {
          showError('ファイルの読み込みに失敗しました');
          return;
        }

        const importedTimeline = importFromJSON(content);
        setTimeline(importedTimeline);
        success(
          `タイムラインをインポートしました（${importedTimeline.length}件）`,
        );
      } catch (err) {
        console.error('Import error:', err);
        showError(
          `インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    if (globalThis.window.electronAPI) {
      globalThis.window.electronAPI.onExportTimeline(handleExport);
      globalThis.window.electronAPI.onImportTimeline(handleImport);
    }

    // クリーンアップは不要（Electronのイベントリスナーは上書きされる）
  }, [timeline, setTimeline, success, showError]);
};
