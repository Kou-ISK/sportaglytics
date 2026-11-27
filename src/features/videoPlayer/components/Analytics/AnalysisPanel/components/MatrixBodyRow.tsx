import React from 'react';
import { Button, TableCell, TableRow, Typography } from '@mui/material';
import type { TimelineData } from '../../../../../../types/timeline/core';
import {
  MATRIX_ROW_CHILD_COLUMN_WIDTH,
  MATRIX_ROW_PARENT_COLUMN_WIDTH,
  MATRIX_ROW_SINGLE_COLUMN_WIDTH,
} from './matrixTableLayout';

type Header = { parent: string | null; child: string };

type MatrixCell = { count: number; entries: TimelineData[] };

type MatrixBodyRowProps = {
  rowHeader: Header;
  rowIndex: number;
  rowHeaders: Header[];
  rowParentSpans: Map<string, number>;
  columnHeaders: Header[];
  rowCells: MatrixCell[];
  onSelectForReview?: (title: string, entries: TimelineData[]) => void;
  onReviewInstances?: (items: TimelineData[]) => void;
  onDrilldown: (title: string, entries: TimelineData[]) => void;
  exportMode?: 'screen' | 'print';
};

export const MatrixBodyRow = ({
  rowHeader,
  rowIndex,
  rowHeaders,
  rowParentSpans,
  columnHeaders,
  rowCells,
  onSelectForReview,
  onReviewInstances,
  onDrilldown,
  exportMode = 'screen',
}: MatrixBodyRowProps) => {
  const isPrint = exportMode === 'print';
  const rowHeaderFontSize = isPrint ? '0.66rem' : '0.64rem';
  const cellValueFontSize = isPrint ? '0.66rem' : '0.62rem';
  const rowTotal = rowCells.reduce((sum, cell) => sum + cell.count, 0);
  const rowEntries = rowCells.flatMap((cell) => cell.entries);
  const rowName = rowHeader.child || '未設定';
  const rowHeading =
    !isPrint && rowEntries.length > 0 && onReviewInstances ? (
      <Button
        size="small"
        sx={{ minWidth: 0, padding: 0, font: 'inherit', color: 'inherit' }}
        aria-label={`${rowHeader.parent ?? ''} ${rowName}、行の映像を再生`.trim()}
        onClick={(event) => {
          if (event.detail === 0) onReviewInstances(rowEntries);
          else onSelectForReview?.(rowName, rowEntries);
        }}
        onDoubleClick={() => onReviewInstances(rowEntries)}
      >
        {rowName}
      </Button>
    ) : (
      rowName
    );
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
            fontSize: rowHeaderFontSize,
            position: isPrint ? 'static' : 'sticky',
            left: isPrint ? 'auto' : 0,
            width: MATRIX_ROW_PARENT_COLUMN_WIDTH,
            minWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
            maxWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
            zIndex: isPrint ? 'auto' : 1,
            whiteSpace: isPrint ? 'normal' : 'nowrap',
            wordBreak: isPrint ? 'break-word' : 'normal',
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
            fontSize: rowHeaderFontSize,
            position: isPrint ? 'static' : 'sticky',
            left: isPrint ? 'auto' : 0,
            width: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
            minWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
            maxWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
            zIndex: isPrint ? 'auto' : 1,
            backgroundColor: 'background.paper',
            whiteSpace: isPrint ? 'normal' : 'nowrap',
            wordBreak: isPrint ? 'break-word' : 'normal',
          }}
        >
          {rowHeading}
        </TableCell>
      )}
      {rowHeader.parent && (
        <TableCell
          sx={{
            fontWeight: 500,
            pl: 2,
            borderRight: '2px solid',
            borderColor: 'divider',
            fontSize: rowHeaderFontSize,
            position: isPrint ? 'static' : 'sticky',
            left: isPrint ? 'auto' : MATRIX_ROW_PARENT_COLUMN_WIDTH,
            width: MATRIX_ROW_CHILD_COLUMN_WIDTH,
            minWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
            maxWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
            zIndex: isPrint ? 'auto' : 1,
            backgroundColor: 'background.paper',
            whiteSpace: isPrint ? 'normal' : 'nowrap',
            wordBreak: isPrint ? 'break-word' : 'normal',
          }}
        >
          {rowHeading}
        </TableCell>
      )}
      {columnHeaders.map((columnHeader, colIndex) => {
        const cell = rowCells[colIndex] ?? { count: 0, entries: [] };
        const rowLabel = rowHeader.parent
          ? `${rowHeader.parent} ${rowHeading}`
          : rowHeader.child || '未設定';
        const colLabel = columnHeader.parent
          ? `${columnHeader.parent} ${columnHeader.child || '未設定'}`
          : columnHeader.child || '未設定';
        const titleLabel = `${rowLabel} × ${colLabel}`;
        const cellKey = `cell-${rowKey}-${columnHeader.parent || ''}-${columnHeader.child}`;

        return (
          <TableCell
            key={cellKey}
            align="center"
            sx={{
              p: 0.5,
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
            }}
          >
            {!isPrint && cell.count > 0 ? (
              <Button
                size="small"
                aria-label={
                  onReviewInstances
                    ? `${titleLabel}、${cell.count}件を再生`
                    : undefined
                }
                onClick={(event) => {
                  if (!onReviewInstances) onDrilldown(titleLabel, cell.entries);
                  else if (event.detail === 0) onReviewInstances(cell.entries);
                  else onSelectForReview?.(titleLabel, cell.entries);
                }}
                onDoubleClick={
                  onReviewInstances
                    ? () => onReviewInstances(cell.entries)
                    : undefined
                }
                onContextMenu={
                  onReviewInstances
                    ? (event) => {
                        event.preventDefault();
                        onDrilldown(titleLabel, cell.entries);
                      }
                    : undefined
                }
                onKeyDown={
                  onReviewInstances
                    ? (event) => {
                        if (
                          event.key === 'ContextMenu' ||
                          (event.shiftKey && event.key === 'F10')
                        ) {
                          event.preventDefault();
                          onDrilldown(titleLabel, cell.entries);
                        }
                      }
                    : undefined
                }
                title={
                  onReviewInstances
                    ? 'ダブルクリックまたはEnterで再生、右クリックで一覧'
                    : undefined
                }
                sx={{ fontSize: cellValueFontSize, minWidth: 30, p: 0.5 }}
              >
                {cell.count}
              </Button>
            ) : (
              <Typography
                variant="caption"
                color={cell.count > 0 ? 'text.secondary' : 'text.disabled'}
                sx={{ fontSize: cellValueFontSize }}
              >
                {cell.count > 0 ? cell.count : '-'}
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
          position: isPrint ? 'static' : 'sticky',
          right: isPrint ? 'auto' : 0,
          zIndex: isPrint ? 'auto' : 1,
          whiteSpace: isPrint ? 'normal' : 'nowrap',
          wordBreak: isPrint ? 'break-word' : 'normal',
        }}
      >
        {!isPrint && rowTotal > 0 ? (
          <Button
            size="small"
            onClick={() => {
              const rowLabel = rowHeader.parent
                ? `${rowHeader.parent} ${rowHeading}`
                : rowHeader.child || '未設定';
              onDrilldown(`${rowLabel} × 合計`, rowEntries);
            }}
            sx={{ fontSize: rowHeaderFontSize, minWidth: 30, p: 0.5 }}
          >
            {rowTotal}
          </Button>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: rowHeaderFontSize }}
          >
            {rowTotal}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};
