/* @vitest-environment jsdom */
import React from 'react';
import { Table } from '@mui/material';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MatrixTableHead } from './MatrixTableHead';

afterEach(() => {
  cleanup();
});

describe('MatrixTableHead', () => {
  it('keeps parent header columns aligned when parented and flat columns are mixed', () => {
    const { container } = render(
      <Table>
        <MatrixTableHead
          rowHeaders={[{ parent: 'Team A', child: 'Scrum' }]}
          columnHeaders={[
            { parent: 'Result', child: 'Won' },
            { parent: 'Result', child: 'Lost' },
            { parent: null, child: '未設定' },
            { parent: 'Type', child: 'Kick' },
          ]}
          rowParentSpans={new Map([['Team A', 1]])}
          colParentSpans={
            new Map([
              ['Result', 2],
              ['Type', 1],
            ])
          }
          hasColumnParent
        />
      </Table>,
    );

    const headerRows = container.querySelectorAll('thead tr');
    const parentHeaderCells = Array.from(
      headerRows[0]?.querySelectorAll('th') ?? [],
    );
    const childHeaderCells = Array.from(
      headerRows[1]?.querySelectorAll('th') ?? [],
    );
    const parentColSpanTotal = parentHeaderCells.reduce(
      (sum, cell) => sum + cell.colSpan,
      0,
    );
    const childColSpanTotal = childHeaderCells.reduce(
      (sum, cell) => sum + cell.colSpan,
      0,
    );

    expect(parentColSpanTotal).toBe(7);
    expect(childColSpanTotal).toBe(6);
  });
});
