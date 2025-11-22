import React from 'react';
import {
  Button,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';

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
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, overflowX: 'auto' }}
      >
        <Table size="small" sx={{ minWidth: 650 }}>
          <TableHead>
            {hasColumnParent && (
              <TableRow>
                <TableCell
                  rowSpan={2}
                  sx={{
                    fontWeight: 600,
                    verticalAlign: 'middle',
                    borderRight: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  行/列
                </TableCell>
                {/* 親要素のヘッダー */}
                {(() => {
                  const renderedParents = new Set<string>();
                  return columnHeaders.map((header) => {
                    const { parent } = header;
                    if (parent && !renderedParents.has(parent)) {
                      renderedParents.add(parent);
                      const colspan = colParentSpans.get(parent) || 1;
                      return (
                        <TableCell
                          key={`parent-${parent}`}
                          colSpan={colspan}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            writingMode: 'vertical-rl',
                            textOrientation: 'upright',
                            minWidth: 40,
                            padding: '8px 4px',
                            fontSize: '0.875rem',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {parent}
                        </TableCell>
                      );
                    }
                    return null;
                  });
                })()}
                <TableCell
                  rowSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 600,
                    verticalAlign: 'middle',
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    writingMode: 'vertical-rl',
                    textOrientation: 'upright',
                    minWidth: 40,
                    padding: '8px 4px',
                  }}
                >
                  合計
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              {!hasColumnParent && (
                <TableCell
                  sx={{
                    fontWeight: 600,
                    borderRight: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  行/列
                </TableCell>
              )}
              {/* 子要素のヘッダー（縦書き） */}
              {columnHeaders.map((header) => {
                const key = header.parent
                  ? `child-${header.parent}-${header.child}`
                  : `child-${header.child}`;
                return (
                  <TableCell
                    key={key}
                    align="center"
                    sx={{
                      fontWeight: 600,
                      writingMode: 'vertical-rl',
                      textOrientation: 'upright',
                      minWidth: 40,
                      padding: '8px 4px',
                      fontSize: '0.875rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {header.child || '未設定'}
                  </TableCell>
                );
              })}
              {!hasColumnParent && (
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 600,
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    writingMode: 'vertical-rl',
                    textOrientation: 'upright',
                    minWidth: 40,
                    padding: '8px 4px',
                  }}
                >
                  合計
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rowHeaders.map((rowHeader, rowIndex) => {
              const rowCells = matrix[rowIndex] ?? [];
              const rowTotal = rowCells.reduce(
                (sum, cell) => sum + cell.count,
                0,
              );

              // 行の親要素の表示判定
              const isFirstOfParent =
                rowIndex === 0 ||
                rowHeaders[rowIndex - 1]?.parent !== rowHeader.parent;
              const rowspan = rowHeader.parent
                ? rowParentSpans.get(rowHeader.parent) || 1
                : 1;

              const rowKey = rowHeader.parent
                ? `row-${rowHeader.parent}-${rowHeader.child}`
                : `row-${rowHeader.child}`;

              return (
                <TableRow key={rowKey} hover>
                  {/* 親要素セル（最初の行のみ） */}
                  {rowHeader.parent && isFirstOfParent && (
                    <TableCell
                      rowSpan={rowspan}
                      sx={{
                        fontWeight: 600,
                        verticalAlign: 'middle',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'action.hover',
                      }}
                    >
                      {rowHeader.parent}
                    </TableCell>
                  )}
                  {/* 親要素がない場合の行ヘッダー */}
                  {!rowHeader.parent && (
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        borderRight: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {rowHeader.child || '未設定'}
                    </TableCell>
                  )}
                  {/* 子要素セル */}
                  {rowHeader.parent && (
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        pl: 2,
                        borderRight: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {rowHeader.child || '未設定'}
                    </TableCell>
                  )}
                  {/* データセル */}
                  {columnHeaders.map((columnHeader, colIndex) => {
                    const cell = rowCells[colIndex] ?? {
                      count: 0,
                      entries: [],
                    };
                    const rowLabel = rowHeader.parent
                      ? `${rowHeader.parent} ${rowHeader.child || '未設定'}`
                      : rowHeader.child || '未設定';
                    const colLabel = columnHeader.parent
                      ? `${columnHeader.parent} ${columnHeader.child || '未設定'}`
                      : columnHeader.child || '未設定';
                    const titleLabel = `${title} - ${rowLabel} × ${colLabel}`;
                    const cellKey = `cell-${rowKey}-${columnHeader.parent || ''}-${columnHeader.child}`;

                    return (
                      <TableCell key={cellKey} align="center">
                        {cell.count > 0 ? (
                          <Button
                            size="small"
                            onClick={() =>
                              onDrilldown(titleLabel, cell.entries)
                            }
                          >
                            {cell.count}
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                  {/* 合計列 */}
                  <TableCell
                    align="center"
                    sx={{
                      borderLeft: '2px solid',
                      borderColor: 'divider',
                      backgroundColor: 'action.hover',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {rowTotal}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
