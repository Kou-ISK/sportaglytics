/* @vitest-environment jsdom */
import React from 'react';
import { Table, TableBody } from '@mui/material';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { MatrixBodyRow } from './MatrixBodyRow';

const createEntry = (id: string): TimelineData => ({
  id,
  actionName: `Team ${id}`,
  startTime: 0,
  endTime: 1,
  memo: '',
});

afterEach(() => {
  cleanup();
});

describe('MatrixBodyRow', () => {
  it('opens drilldown from the row total with all row entries', () => {
    const entries = [createEntry('entry-1'), createEntry('entry-2')];
    const handleDrilldown = vi.fn();

    render(
      <Table>
        <TableBody>
          <MatrixBodyRow
            rowHeader={{ parent: null, child: 'Scrum' }}
            rowIndex={0}
            rowHeaders={[{ parent: null, child: 'Scrum' }]}
            rowParentSpans={new Map()}
            columnHeaders={[
              { parent: 'Result', child: 'Won' },
              { parent: 'Result', child: 'Lost' },
            ]}
            rowCells={[
              { count: 1, entries: [entries[0]] },
              { count: 1, entries: [entries[1]] },
            ]}
            onDrilldown={handleDrilldown}
          />
        </TableBody>
      </Table>,
    );

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(handleDrilldown).toHaveBeenCalledWith('Scrum × 合計', entries);
  });
});
