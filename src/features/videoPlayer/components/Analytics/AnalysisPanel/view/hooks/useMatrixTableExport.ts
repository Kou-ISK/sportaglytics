import { useCallback } from 'react';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';
import type { NotificationContextValue } from '../../../../../../../contexts/NotificationContext';
import { buildHierarchicalMatrix } from '../../../../../../../utils/matrixBuilder';
import {
  buildMatrixCsv,
  buildMatrixExportAoa,
  buildMatrixXlsxBase64,
} from '../../../../../../../utils/matrixExport';

interface UseMatrixTableExportParams {
  customMatrix: ReturnType<typeof buildHierarchicalMatrix>;
  customRowAxis: MatrixAxisConfig;
  customColumnAxis: MatrixAxisConfig;
  notification: NotificationContextValue;
}

const axisToken = (value: string | undefined) =>
  (value || '-')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

export const useMatrixTableExport = ({
  customMatrix,
  customRowAxis,
  customColumnAxis,
  notification,
}: UseMatrixTableExportParams) => {
  const exportMatrix = useCallback(
    async (format: 'csv' | 'xlsx') => {
      const api = globalThis.window.electronAPI;
      if (!api?.saveFileDialog || !api?.writeTextFile || !api?.writeBinaryFile) {
        notification.error('エクスポート機能が利用できません。');
        return;
      }

      if (!customMatrix || customMatrix.rowHeaders.length === 0) {
        notification.warning('エクスポート対象のクロス集計データがありません。');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const rowToken = `${customRowAxis.type}-${axisToken(customRowAxis.value)}`;
      const colToken = `${customColumnAxis.type}-${axisToken(customColumnAxis.value)}`;
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      const defaultName = `matrix-${rowToken}-${colToken}-${date}.${extension}`;
      const filterName = format === 'csv' ? 'CSV' : 'Excel';

      const filePath = await api.saveFileDialog(defaultName, [
        { name: filterName, extensions: [extension] },
      ]);

      if (!filePath) return;

      const aoa = buildMatrixExportAoa({
        table: {
          rowHeaders: customMatrix.rowHeaders,
          columnHeaders: customMatrix.columnHeaders,
          matrix: customMatrix.matrix,
        },
      });

      if (format === 'csv') {
        const csv = buildMatrixCsv(aoa);
        const ok = await api.writeTextFile(filePath, csv);
        if (ok) {
          notification.success('クロス集計CSVを保存しました。');
        } else {
          notification.error('クロス集計CSVの保存に失敗しました。');
        }
        return;
      }

      const xlsxBase64 = buildMatrixXlsxBase64(aoa, 'Matrix');
      const ok = await api.writeBinaryFile(filePath, xlsxBase64);
      if (ok) {
        notification.success('クロス集計XLSXを保存しました。');
      } else {
        notification.error('クロス集計XLSXの保存に失敗しました。');
      }
    },
    [customColumnAxis, customMatrix, customRowAxis, notification],
  );

  return { exportMatrix };
};
