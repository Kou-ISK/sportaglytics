import React from 'react';
import { Button, TableCell, TableHead, TableRow } from '@mui/material';
import {
  MATRIX_ROW_CHILD_COLUMN_WIDTH,
  MATRIX_ROW_PARENT_COLUMN_WIDTH,
  MATRIX_ROW_SINGLE_COLUMN_WIDTH,
} from './matrixTableLayout';

type Header = { parent: string | null; child: string };

type MatrixTableHeadProps = {
  rowHeaders: Header[];
  columnHeaders: Header[];
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  hasColumnParent: boolean;
  onColumnClick?: (columnIndex: number, keyboard: boolean) => void;
  onColumnDoubleClick?: (columnIndex: number) => void;
  exportMode?: 'screen' | 'print';
};

export const MatrixTableHead = ({
  rowHeaders,
  columnHeaders,
  rowParentSpans: _rowParentSpans,
  colParentSpans: _colParentSpans,
  hasColumnParent,
  onColumnClick,
  onColumnDoubleClick,
  exportMode = 'screen',
}: MatrixTableHeadProps) => {
  const isPrint = exportMode === 'print';
  const hasRowParent = rowHeaders.some((header) => header.parent !== null);
  const headerFontSize = isPrint ? '0.66rem' : '0.64rem';
  const parentHeaderCells = columnHeaders.reduce<
    Array<{ key: string; name: string | null; colspan: number }>
  >((cells, header, index) => {
    if (!header.parent) {
      cells.push({
        key: `parent-empty-${index}-${header.child || 'unset'}`,
        name: null,
        colspan: 1,
      });
      return cells;
    }

    const previous = cells[cells.length - 1];
    if (previous?.name === header.parent) {
      previous.colspan += 1;
      return cells;
    }

    cells.push({
      key: `parent-${header.parent}-${index}`,
      name: header.parent,
      colspan: 1,
    });
    return cells;
  }, []);

  return (
    <TableHead>
      {hasColumnParent && (
        <TableRow>
          {hasRowParent ? (
            <>
              <TableCell
                sx={{
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  position: isPrint ? 'static' : 'sticky',
                  left: isPrint ? 'auto' : 0,
                  width: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                  minWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                  maxWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                  zIndex: isPrint ? 'auto' : 4,
                  backgroundColor: 'background.paper',
                }}
              />
              <TableCell
                sx={{
                  borderRight: '2px solid',
                  borderColor: 'divider',
                  position: isPrint ? 'static' : 'sticky',
                  left: isPrint ? 'auto' : MATRIX_ROW_PARENT_COLUMN_WIDTH,
                  width: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                  minWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                  maxWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                  zIndex: isPrint ? 'auto' : 4,
                  backgroundColor: 'background.paper',
                }}
              />
            </>
          ) : (
            <TableCell
              sx={{
                borderRight: '2px solid',
                borderColor: 'divider',
                position: isPrint ? 'static' : 'sticky',
                left: isPrint ? 'auto' : 0,
                width: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
                minWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
                maxWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
                zIndex: isPrint ? 'auto' : 4,
                backgroundColor: 'background.paper',
              }}
            />
          )}
          {parentHeaderCells.map(({ key, name, colspan }) => (
            <TableCell
              key={key}
              colSpan={colspan}
              align="center"
              sx={{
                fontWeight: 600,
                borderBottom: '1px solid',
                borderColor: 'divider',
                writingMode: isPrint ? 'horizontal-tb' : 'vertical-rl',
                minWidth: isPrint ? 70 : 32,
                padding: isPrint ? '4px 6px' : '6px 2px',
                fontSize: headerFontSize,
                letterSpacing: '0.02em',
                whiteSpace: isPrint ? 'normal' : 'nowrap',
                wordBreak: isPrint ? 'break-word' : 'normal',
              }}
            >
              {name}
            </TableCell>
          ))}
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
              fontSize: headerFontSize,
              position: isPrint ? 'static' : 'sticky',
              right: isPrint ? 'auto' : 0,
              zIndex: isPrint ? 'auto' : 4,
              backgroundColor: 'background.paper',
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
            }}
          >
            合計
          </TableCell>
        </TableRow>
      )}
      <TableRow>
        {hasRowParent ? (
          <>
            <TableCell
              sx={{
                fontWeight: 600,
                verticalAlign: 'middle',
                borderRight: '1px solid',
                borderColor: 'divider',
                fontSize: headerFontSize,
                position: isPrint ? 'static' : 'sticky',
                left: isPrint ? 'auto' : 0,
                width: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                minWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                maxWidth: MATRIX_ROW_PARENT_COLUMN_WIDTH,
                zIndex: isPrint ? 'auto' : 3,
                backgroundColor: 'background.paper',
                whiteSpace: isPrint ? 'normal' : 'nowrap',
                wordBreak: isPrint ? 'break-word' : 'normal',
              }}
            />
            <TableCell
              sx={{
                fontWeight: 600,
                verticalAlign: 'middle',
                borderRight: '2px solid',
                borderColor: 'divider',
                fontSize: headerFontSize,
                position: isPrint ? 'static' : 'sticky',
                left: isPrint ? 'auto' : MATRIX_ROW_PARENT_COLUMN_WIDTH,
                width: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                minWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                maxWidth: MATRIX_ROW_CHILD_COLUMN_WIDTH,
                zIndex: isPrint ? 'auto' : 3,
                backgroundColor: 'background.paper',
                whiteSpace: isPrint ? 'normal' : 'nowrap',
                wordBreak: isPrint ? 'break-word' : 'normal',
              }}
            />
          </>
        ) : (
          <TableCell
            sx={{
              fontWeight: 600,
              borderRight: '2px solid',
              borderColor: 'divider',
              fontSize: headerFontSize,
              position: isPrint ? 'static' : 'sticky',
              left: isPrint ? 'auto' : 0,
              width: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
              minWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
              maxWidth: MATRIX_ROW_SINGLE_COLUMN_WIDTH,
              zIndex: isPrint ? 'auto' : 3,
              backgroundColor: 'background.paper',
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
            }}
          />
        )}
        {columnHeaders.map((header, columnIndex) => {
          const key = header.parent
            ? `child-${header.parent}-${header.child}`
            : `child-${header.child}`;
          return (
            <TableCell
              key={key}
              align="center"
              sx={{
                fontWeight: 600,
                writingMode: isPrint ? 'horizontal-tb' : 'vertical-rl',
                minWidth: isPrint ? 70 : 32,
                padding: isPrint ? '4px 6px' : '6px 2px',
                fontSize: headerFontSize,
                letterSpacing: '0.02em',
                whiteSpace: isPrint ? 'normal' : 'nowrap',
                wordBreak: isPrint ? 'break-word' : 'normal',
              }}
            >
              {!isPrint && onColumnDoubleClick ? (
                <Button
                  size="small"
                  sx={{
                    minWidth: 0,
                    padding: 0,
                    font: 'inherit',
                    writingMode: 'inherit',
                    color: 'inherit',
                  }}
                  aria-label={`${header.parent ?? ''} ${header.child || '未設定'}、列の映像を再生`.trim()}
                  onClick={(event) =>
                    onColumnClick?.(columnIndex, event.detail === 0)
                  }
                  onDoubleClick={() => onColumnDoubleClick(columnIndex)}
                >
                  {header.child || '未設定'}
                </Button>
              ) : (
                header.child || '未設定'
              )}
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
              fontSize: headerFontSize,
              position: isPrint ? 'static' : 'sticky',
              right: isPrint ? 'auto' : 0,
              zIndex: isPrint ? 'auto' : 3,
              backgroundColor: 'background.paper',
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
            }}
          >
            合計
          </TableCell>
        )}
      </TableRow>
    </TableHead>
  );
};
