import { useCallback } from 'react';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { NotificationContextValue } from '../../../../../../contexts/NotificationContext';
import { buildHierarchicalMatrix } from '../../../../../../utils/matrixBuilder';
import {
  buildMatrixCsv,
  buildMatrixExportAoa,
  buildMatrixXlsxBase64,
} from '../../../../../../utils/matrixExport';
import { saveMatrixTableExport } from '../gateways/matrixTableExportGateway';

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
      if (!customMatrix || customMatrix.rowHeaders.length === 0) {
        notification.warning(
          'エクスポート対象のクロス集計データがありません。',
        );
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const rowToken = `${customRowAxis.type}-${axisToken(customRowAxis.value)}`;
      const colToken = `${customColumnAxis.type}-${axisToken(customColumnAxis.value)}`;
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      const defaultName = `matrix-${rowToken}-${colToken}-${date}.${extension}`;
      const filterName = format === 'csv' ? 'CSV' : 'Excel';

      const aoa = buildMatrixExportAoa({
        table: {
          rowHeaders: customMatrix.rowHeaders,
          columnHeaders: customMatrix.columnHeaders,
          matrix: customMatrix.matrix,
        },
      });

      const result = await saveMatrixTableExport(
        defaultName,
        [{ name: filterName, extensions: [extension] }],
        format === 'csv'
          ? { kind: 'text', content: buildMatrixCsv(aoa) }
          : { kind: 'base64', content: buildMatrixXlsxBase64(aoa, 'Matrix') },
      );

      if (result === 'cancelled') {
        return;
      }
      if (result === 'unavailable') {
        notification.error('エクスポート機能が利用できません。');
        return;
      }
      if (result === 'failed') {
        notification.error(
          format === 'csv'
            ? 'クロス集計CSVの保存に失敗しました。'
            : 'クロス集計XLSXの保存に失敗しました。',
        );
        return;
      }

      notification.success(
        format === 'csv'
          ? 'クロス集計CSVを保存しました。'
          : 'クロス集計XLSXを保存しました。',
      );
    },
    [customColumnAxis, customMatrix, customRowAxis, notification],
  );

  return { exportMatrix };
};
