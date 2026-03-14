import React from 'react';
import { TableCell, TableHead, TableRow } from '@mui/material';

type Header = { parent: string | null; child: string };

type MatrixTableHeadProps = {
  rowHeaders: Header[];
  columnHeaders: Header[];
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  hasColumnParent: boolean;
  exportMode?: 'screen' | 'print';
};

export const MatrixTableHead = ({
  rowHeaders,
  columnHeaders,
  rowParentSpans: _rowParentSpans,
  colParentSpans,
  hasColumnParent,
  exportMode = 'screen',
}: MatrixTableHeadProps) => {
  const isPrint = exportMode === 'print';
  const hasRowParent = rowHeaders.some((header) => header.parent !== null);
  const maxParentLabelLength = columnHeaders.reduce((max, header) => {
    return Math.max(max, header.parent?.length ?? 0);
  }, 0);
  const parentHeaderHeight = hasColumnParent
    ? Math.min(72, Math.max(32, 16 + maxParentLabelLength * 8))
    : 0;
  const firstRowTop = isPrint ? undefined : 0;
  const secondRowTop = isPrint ? undefined : parentHeaderHeight;
  const headerFontSize = isPrint ? '0.66rem' : '0.64rem';

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
                  zIndex: isPrint ? 'auto' : 4,
                  top: firstRowTop,
                  backgroundColor: 'background.paper',
                }}
              />
              <TableCell
                sx={{
                  borderRight: '2px solid',
                  borderColor: 'divider',
                  position: isPrint ? 'static' : 'sticky',
                  left: isPrint ? 'auto' : 0,
                  zIndex: isPrint ? 'auto' : 4,
                  top: firstRowTop,
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
                zIndex: isPrint ? 'auto' : 4,
                top: firstRowTop,
                backgroundColor: 'background.paper',
              }}
            />
          )}
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
                  writingMode: isPrint ? 'horizontal-tb' : 'vertical-rl',
                  minWidth: isPrint ? 70 : 32,
                  padding: isPrint ? '4px 6px' : '6px 2px',
                  fontSize: headerFontSize,
                  letterSpacing: '0.02em',
                  whiteSpace: isPrint ? 'normal' : 'nowrap',
                  wordBreak: isPrint ? 'break-word' : 'normal',
                  top: firstRowTop,
                  zIndex: isPrint ? 'auto' : 4,
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
              fontSize: headerFontSize,
              position: isPrint ? 'static' : 'sticky',
              right: isPrint ? 'auto' : 0,
              zIndex: isPrint ? 'auto' : 4,
              top: firstRowTop,
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
                zIndex: isPrint ? 'auto' : 3,
                top: secondRowTop,
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
                left: isPrint ? 'auto' : 0,
                zIndex: isPrint ? 'auto' : 3,
                top: secondRowTop,
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
              zIndex: isPrint ? 'auto' : 3,
              top: secondRowTop,
              backgroundColor: 'background.paper',
              whiteSpace: isPrint ? 'normal' : 'nowrap',
              wordBreak: isPrint ? 'break-word' : 'normal',
            }}
          />
        )}
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
                writingMode: isPrint ? 'horizontal-tb' : 'vertical-rl',
                minWidth: isPrint ? 70 : 32,
                padding: isPrint ? '4px 6px' : '6px 2px',
                fontSize: headerFontSize,
                letterSpacing: '0.02em',
                whiteSpace: isPrint ? 'normal' : 'nowrap',
                wordBreak: isPrint ? 'break-word' : 'normal',
                top: secondRowTop,
                zIndex: isPrint ? 'auto' : 3,
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
              fontSize: headerFontSize,
              position: isPrint ? 'static' : 'sticky',
              right: isPrint ? 'auto' : 0,
              zIndex: isPrint ? 'auto' : 3,
              top: secondRowTop,
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
