/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultMatrixFilters,
  type MatrixFilterState,
} from '../controllers/matrixFilterUtils';
import { MatrixFilters } from './MatrixFilters';

const activeFilters = {
  team: 'Chiba',
  action: 'Scrum',
  labelGroup: 'Result',
  labelValue: 'Won',
};

const renderFilters = (props?: {
  onFiltersApply?: (filters: MatrixFilterState) => void;
  onClose?: () => void;
}) => {
  render(
    <MatrixFilters
      filters={activeFilters}
      availableTeams={['Chiba']}
      availableActions={['Scrum']}
      availableLabelValues={['Won']}
      availableActionsByTeam={{ Chiba: ['Scrum'] }}
      availableLabelValuesByGroup={{ Result: ['Won'] }}
      availableGroups={['Result']}
      onFiltersApply={props?.onFiltersApply ?? vi.fn()}
      hasActiveFilters
      onApply={vi.fn()}
      onClose={props?.onClose ?? vi.fn()}
    />,
  );
};

afterEach(() => {
  cleanup();
});

describe('MatrixFilters', () => {
  it('applies cleared draft filters only after pressing apply', () => {
    const handleApply = vi.fn();
    renderFilters({ onFiltersApply: handleApply });

    fireEvent.click(screen.getByRole('button', { name: 'すべてクリア' }));
    expect(handleApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '適用' }));
    expect(handleApply).toHaveBeenCalledWith(createDefaultMatrixFilters());
  });

  it('discards draft changes when closing', () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();
    renderFilters({ onFiltersApply: handleApply, onClose: handleClose });

    fireEvent.click(screen.getByRole('button', { name: 'すべてクリア' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(handleApply).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
