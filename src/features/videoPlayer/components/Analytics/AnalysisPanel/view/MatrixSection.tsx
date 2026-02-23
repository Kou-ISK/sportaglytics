import React from 'react';
import { Paper, Table, TableBody, TableContainer } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import { MatrixTableHead } from './MatrixTableHead';
import { MatrixBodyRow } from './MatrixBodyRow';

interface MatrixSectionProps {
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  matrix: Array<Array<{ count: number; entries: TimelineData[] }>>;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
  exportMode?: 'screen' | 'print';
}

export const MatrixSection = ({
  rowHeaders,
  columnHeaders,
  rowParentSpans,
  colParentSpans,
  matrix,
  onDrilldown,
  exportMode = 'screen',
}: MatrixSectionProps) => {
  if (rowHeaders.length === 0 || columnHeaders.length === 0) {
    return null;
  }

  const isPrint = exportMode === 'print';

  // 列ヘッダーに親要素がある場合、2行構成
  const hasColumnParent = columnHeaders.some((h) => h.parent !== null);

  return (
    <Paper elevation={1} sx={{ p: 1, borderRadius: 2 }}>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          maxHeight: isPrint ? 'none' : '70vh',
          overflow: isPrint ? 'visible' : 'auto',
          position: 'relative',
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: isPrint ? 0 : 650,
            '& thead th': {
              position: isPrint ? 'static' : 'sticky',
              top: isPrint ? 'auto' : 0,
              backgroundColor: 'background.paper',
              zIndex: isPrint ? 'auto' : 2,
            },
            '& tbody th': {
              position: isPrint ? 'static' : 'sticky',
              left: isPrint ? 'auto' : 0,
              backgroundColor: 'background.paper',
              zIndex: isPrint ? 'auto' : 1,
            },
            '& th, & td': {
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
              lineHeight: 1.25,
            },
          }}
        >
          <MatrixTableHead
            rowHeaders={rowHeaders}
            columnHeaders={columnHeaders}
            rowParentSpans={rowParentSpans}
            colParentSpans={colParentSpans}
            hasColumnParent={hasColumnParent}
            exportMode={exportMode}
          />
          <TableBody>
            {rowHeaders.map((rowHeader, rowIndex) => (
              <MatrixBodyRow
                key={
                  rowHeader.parent
                    ? `row-${rowHeader.parent}-${rowHeader.child}`
                    : `row-${rowHeader.child}`
                }
                rowHeader={rowHeader}
                rowIndex={rowIndex}
                rowHeaders={rowHeaders}
                rowParentSpans={rowParentSpans}
                columnHeaders={columnHeaders}
                rowCells={matrix[rowIndex] ?? []}
                onDrilldown={onDrilldown}
                exportMode={exportMode}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
