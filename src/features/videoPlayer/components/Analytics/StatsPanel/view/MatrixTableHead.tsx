import React from 'react';
import { TableCell, TableHead, TableRow } from '@mui/material';

type Header = { parent: string | null; child: string };

type MatrixTableHeadProps = {
  rowHeaders: Header[];
  columnHeaders: Header[];
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
  hasColumnParent: boolean;
};

export const MatrixTableHead = ({
  rowHeaders,
  columnHeaders,
  rowParentSpans,
  colParentSpans,
  hasColumnParent,
}: MatrixTableHeadProps) => {
  const hasRowParent = rowHeaders.some((header) => header.parent !== null);

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
          ) : (
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
        {hasRowParent ? (
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
        ) : (
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
  );
};
