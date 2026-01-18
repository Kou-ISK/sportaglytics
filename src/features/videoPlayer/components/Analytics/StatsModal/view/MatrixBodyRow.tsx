import React from 'react';
import { Button, TableCell, TableRow, Typography } from '@mui/material';
import type { TimelineData } from '../../../../../../types/TimelineData';

type Header = { parent: string | null; child: string };

type MatrixCell = { count: number; entries: TimelineData[] };

type MatrixBodyRowProps = {
  title: string;
  rowHeader: Header;
  rowIndex: number;
  rowHeaders: Header[];
  rowParentSpans: Map<string, number>;
  columnHeaders: Header[];
  rowCells: MatrixCell[];
  onDrilldown: (title: string, entries: TimelineData[]) => void;
};

export const MatrixBodyRow = ({
  title,
  rowHeader,
  rowIndex,
  rowHeaders,
  rowParentSpans,
  columnHeaders,
  rowCells,
  onDrilldown,
}: MatrixBodyRowProps) => {
  const rowTotal = rowCells.reduce((sum, cell) => sum + cell.count, 0);
  const isFirstOfParent =
    rowIndex === 0 || rowHeaders[rowIndex - 1]?.parent !== rowHeader.parent;
  const rowspan = rowHeader.parent
    ? rowParentSpans.get(rowHeader.parent) || 1
    : 1;

  const rowKey = rowHeader.parent
    ? `row-${rowHeader.parent}-${rowHeader.child}`
    : `row-${rowHeader.child}`;

  return (
    <TableRow key={rowKey} hover>
      {rowHeader.parent && isFirstOfParent && (
        <TableCell
          rowSpan={rowspan}
          sx={{
            fontWeight: 600,
            verticalAlign: 'middle',
            borderRight: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'action.hover',
            fontSize: '0.7rem',
            position: 'sticky',
            left: 0,
            zIndex: 1,
          }}
        >
          {rowHeader.parent}
        </TableCell>
      )}
      {!rowHeader.parent && (
        <TableCell
          sx={{
            fontWeight: 600,
            borderRight: '2px solid',
            borderColor: 'divider',
            fontSize: '0.7rem',
            position: 'sticky',
            left: 0,
            zIndex: 1,
            backgroundColor: 'background.paper',
          }}
        >
          {rowHeader.child || '未設定'}
        </TableCell>
      )}
      {rowHeader.parent && (
        <TableCell
          sx={{
            fontWeight: 500,
            pl: 2,
            borderRight: '2px solid',
            borderColor: 'divider',
            fontSize: '0.7rem',
            position: 'sticky',
            left: 0,
            zIndex: 1,
            backgroundColor: 'background.paper',
          }}
        >
          {rowHeader.child || '未設定'}
        </TableCell>
      )}
      {columnHeaders.map((columnHeader, colIndex) => {
        const cell = rowCells[colIndex] ?? { count: 0, entries: [] };
        const rowLabel = rowHeader.parent
          ? `${rowHeader.parent} ${rowHeader.child || '未設定'}`
          : rowHeader.child || '未設定';
        const colLabel = columnHeader.parent
          ? `${columnHeader.parent} ${columnHeader.child || '未設定'}`
          : columnHeader.child || '未設定';
        const titleLabel = `${title} - ${rowLabel} × ${colLabel}`;
        const cellKey = `cell-${rowKey}-${columnHeader.parent || ''}-${columnHeader.child}`;

        return (
          <TableCell key={cellKey} align="center" sx={{ p: 0.5 }}>
            {cell.count > 0 ? (
              <Button
                size="small"
                onClick={() => onDrilldown(titleLabel, cell.entries)}
                sx={{ fontSize: '0.7rem', minWidth: 32, p: 0.5 }}
              >
                {cell.count}
              </Button>
            ) : (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontSize: '0.65rem' }}
              >
                -
              </Typography>
            )}
          </TableCell>
        );
      })}
      <TableCell
        align="center"
        sx={{
          borderLeft: '2px solid',
          borderColor: 'divider',
          backgroundColor: 'action.hover',
          width: 48,
          minWidth: 48,
          maxWidth: 48,
          p: 0.5,
          position: 'sticky',
          right: 0,
          zIndex: 1,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: '0.7rem' }}
        >
          {rowTotal}
        </Typography>
      </TableCell>
    </TableRow>
  );
};
