import React from 'react';
import { Paper, Table, TableBody, TableContainer } from '@mui/material';
import { TimelineData } from '../../../../../../types/timeline/core';
import { MatrixTableHead } from './MatrixTableHead';
import { MatrixBodyRow } from './MatrixBodyRow';

interface MatrixSectionProps {
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  matrix: Array<Array<{ count: number; entries: TimelineData[] }>>;
  onSelectForReview?: (title: string, entries: TimelineData[]) => void;
  onReviewInstances?: (items: TimelineData[]) => void;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
  exportMode?: 'screen' | 'print';
}

export const MatrixSection = ({
  rowHeaders,
  columnHeaders,
  rowParentSpans,
  colParentSpans,
  matrix,
  onSelectForReview,
  onReviewInstances,
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
    <Paper
      elevation={1}
      sx={{
        p: 1,
        borderRadius: 2,
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          width: '100%',
          maxWidth: '100%',
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
              backgroundColor: 'background.paper',
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
              fontSize: isPrint ? '0.68rem' : '0.64rem',
            },
          }}
        >
          <MatrixTableHead
            rowHeaders={rowHeaders}
            columnHeaders={columnHeaders}
            rowParentSpans={rowParentSpans}
            colParentSpans={colParentSpans}
            onColumnClick={
              onReviewInstances
                ? (index, keyboard) => {
                    const entries = matrix.flatMap(
                      (row) => row[index]?.entries ?? [],
                    );
                    if (keyboard) onReviewInstances(entries);
                    else {
                      const header = columnHeaders[index];
                      onSelectForReview?.(
                        [header.parent, header.child].filter(Boolean).join(' '),
                        entries,
                      );
                    }
                  }
                : undefined
            }
            onColumnDoubleClick={
              onReviewInstances
                ? (index) => {
                    onReviewInstances(
                      matrix.flatMap((row) => row[index]?.entries ?? []),
                    );
                  }
                : undefined
            }
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
                onSelectForReview={onSelectForReview}
                onReviewInstances={onReviewInstances}
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
