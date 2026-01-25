import React from 'react';
import { Divider, Paper, Table, TableBody, TableContainer, Typography } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import { MatrixTableHead } from './MatrixTableHead';
import { MatrixBodyRow } from './MatrixBodyRow';

interface MatrixSectionProps {
  title: string;
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  matrix: Array<Array<{ count: number; entries: TimelineData[] }>>;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
}

export const MatrixSection = ({
  title,
  rowHeaders,
  columnHeaders,
  rowParentSpans,
  colParentSpans,
  matrix,
  onDrilldown,
}: MatrixSectionProps) => {
  if (rowHeaders.length === 0 || columnHeaders.length === 0) {
    return null;
  }

  // 列ヘッダーに親要素がある場合、2行構成
  const hasColumnParent = columnHeaders.some((h) => h.parent !== null);

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, mb: 2, fontSize: '0.8rem' }}
      >
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          maxHeight: '70vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: 650,
            '& thead th': {
              position: 'sticky',
              top: 0,
              backgroundColor: 'background.paper',
              zIndex: 2,
            },
            '& tbody th': {
              position: 'sticky',
              left: 0,
              backgroundColor: 'background.paper',
              zIndex: 1,
            },
          }}
        >
          <MatrixTableHead
            rowHeaders={rowHeaders}
            columnHeaders={columnHeaders}
            rowParentSpans={rowParentSpans}
            colParentSpans={colParentSpans}
            hasColumnParent={hasColumnParent}
          />
          <TableBody>
            {rowHeaders.map((rowHeader, rowIndex) => (
              <MatrixBodyRow
                key={
                  rowHeader.parent
                    ? `row-${rowHeader.parent}-${rowHeader.child}`
                    : `row-${rowHeader.child}`
                }
                title={title}
                rowHeader={rowHeader}
                rowIndex={rowIndex}
                rowHeaders={rowHeaders}
                rowParentSpans={rowParentSpans}
                columnHeaders={columnHeaders}
                rowCells={matrix[rowIndex] ?? []}
                onDrilldown={onDrilldown}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
