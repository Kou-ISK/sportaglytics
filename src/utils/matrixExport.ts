import * as XLSX from 'xlsx';

type HeaderCell = { parent: string | null; child: string };
type MatrixCountCell = { count: number };

export interface MatrixExportTable {
  rowHeaders: HeaderCell[];
  columnHeaders: HeaderCell[];
  matrix: MatrixCountCell[][];
}

interface BuildMatrixExportAoaParams {
  table: MatrixExportTable;
}

type AoaCell = string | number;
export type MatrixExportAoa = AoaCell[][];

const headerLabel = (header: HeaderCell) =>
  header.parent ? `${header.parent} > ${header.child || '未設定'}` : header.child || '未設定';

const toUniqueLabels = (headers: HeaderCell[]) => {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const base = headerLabel(header);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return base;
    return `${base} (${count + 1})`;
  });
};

export const buildMatrixExportAoa = ({
  table,
}: BuildMatrixExportAoaParams): MatrixExportAoa => {
  const { rowHeaders, columnHeaders, matrix } = table;
  const columnLabels = toUniqueLabels(columnHeaders);
  const columnTotals = new Array(columnHeaders.length).fill(0);

  const aoa: MatrixExportAoa = [['RowParent', 'Row', ...columnLabels, 'RowTotal']];

  let grandTotal = 0;

  rowHeaders.forEach((rowHeader, rowIndex) => {
    const counts = columnHeaders.map((_, colIndex) => {
      const value = matrix[rowIndex]?.[colIndex]?.count ?? 0;
      columnTotals[colIndex] += value;
      return value;
    });
    const rowTotal = counts.reduce((sum, value) => sum + value, 0);
    grandTotal += rowTotal;

    aoa.push([
      rowHeader.parent || '',
      rowHeader.child || '未設定',
      ...counts,
      rowTotal,
    ]);
  });

  aoa.push(['ColumnTotal', '', ...columnTotals, grandTotal]);

  return aoa;
};

const toCsvCell = (value: AoaCell) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

export const buildMatrixCsv = (aoa: MatrixExportAoa): string =>
  aoa.map((row) => row.map(toCsvCell).join(',')).join('\n');

export const buildMatrixXlsxBase64 = (
  aoa: MatrixExportAoa,
  sheetName = 'Matrix',
): string => {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
};
