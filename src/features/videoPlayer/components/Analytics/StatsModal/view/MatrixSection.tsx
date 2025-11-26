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
          <TableHead>
            {hasColumnParent && (
              <TableRow>
                {/* 行ヘッダー領域: 行にも親がある場合は2列分の空白 */}
                {(() => {
                  const hasRowParent = rowHeaders.some(
                    (h) => h.parent !== null,
                  );
                  if (hasRowParent) {
                    return (
                      <>
                        <TableCell
                          sx={{
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            position: 'sticky',
                            left: 0,
                            zIndex: 3,
                            backgroundColor: 'background.paper',
                          }}
                        />
                        <TableCell
                          sx={{
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            position: 'sticky',
                            left: 0,
                            zIndex: 3,
                            backgroundColor: 'background.paper',
                          }}
                        />
                      </>
                    );
                  } else {
                    return (
                      <TableCell
                        sx={{
                          borderRight: '2px solid',
                          borderColor: 'divider',
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                        }}
                      />
                    );
                  }
                })()}
                {/* 親要素のヘッダー */}
                {(() => {
                  const parents: Array<{ name: string; colspan: number }> = [];
                  const seen = new Set<string>();
                  for (const header of columnHeaders) {
                    if (header.parent && !seen.has(header.parent)) {
                      seen.add(header.parent);
                      parents.push({
                        name: header.parent,
                        colspan: colParentSpans.get(header.parent) || 1,
                      });
                    }
                  }
                  return parents.map(({ name, colspan }) => (
                    <TableCell
                      key={`parent-${name}`}
                      colSpan={colspan}
                      align="center"
                      sx={{
                        fontWeight: 600,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        writingMode: 'vertical-rl',
                        minWidth: 32,
                        padding: '6px 2px',
                        fontSize: '0.7rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {name}
                    </TableCell>
                  ));
                })()}
                <TableCell
                  rowSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 600,
                    verticalAlign: 'middle',
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    width: 48,
                    minWidth: 48,
                    maxWidth: 48,
                    p: 0.5,
                    fontSize: '0.7rem',
                    position: 'sticky',
                    right: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                  }}
                >
                  合計
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              {/* 行ヘッダー領域: 空白 */}
              {(() => {
                const hasRowParent = rowHeaders.some((h) => h.parent !== null);
                if (hasRowParent) {
                  return (
                    <>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          verticalAlign: 'middle',
                          borderRight: '1px solid',
                          borderColor: 'divider',
                          fontSize: '0.7rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                        }}
                      />
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          verticalAlign: 'middle',
                          borderRight: '2px solid',
                          borderColor: 'divider',
                          fontSize: '0.7rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                        }}
                      />
                    </>
                  );
                } else {
                  return (
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        borderRight: '2px solid',
                        borderColor: 'divider',
                        fontSize: '0.7rem',
                        position: 'sticky',
                        left: 0,
                        zIndex: 3,
                        backgroundColor: 'background.paper',
                      }}
                    />
                  );
                }
              })()}
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
                      minWidth: 32,
                      padding: '6px 2px',
                      fontSize: '0.7rem',
                      letterSpacing: '0.02em',
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
                    width: 48,
                    minWidth: 48,
                    maxWidth: 48,
                    p: 0.5,
                    fontSize: '0.7rem',
                    position: 'sticky',
                    right: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
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
                        fontSize: '0.7rem',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
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
                  {/* 子要素セル */}
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
                      <TableCell key={cellKey} align="center" sx={{ p: 0.5 }}>
                        {cell.count > 0 ? (
                          <Button
                            size="small"
                            onClick={() =>
                              onDrilldown(titleLabel, cell.entries)
                            }
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
                  {/* 合計列 */}
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
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
