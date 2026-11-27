/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MatrixSection } from './MatrixSection';

it('selects first; double-click or keyboard plays cells and leaf headings without opening the drilldown', () => {
  const item = {
    id: 'a',
    actionName: 'Scrum',
    startTime: 2,
    endTime: 4,
    memo: '',
  };
  const onReviewInstances = vi.fn();
  const onSelectForReview = vi.fn();
  const onDrilldown = vi.fn();
  render(
    <MatrixSection
      rowHeaders={[{ parent: null, child: 'Scrum' }]}
      columnHeaders={[{ parent: null, child: 'Won' }]}
      rowParentSpans={new Map()}
      colParentSpans={new Map()}
      matrix={[[{ count: 1, entries: [item] }]]}
      onSelectForReview={onSelectForReview}
      onReviewInstances={onReviewInstances}
      onDrilldown={onDrilldown}
    />,
  );
  const count = screen.getByRole('button', { name: 'Scrum × Won、1件を再生' });
  fireEvent.click(count, { detail: 1 });
  expect(onSelectForReview).toHaveBeenCalledWith('Scrum × Won', [item]);
  expect(onReviewInstances).not.toHaveBeenCalled();
  expect(onDrilldown).not.toHaveBeenCalled();
  fireEvent.doubleClick(count);
  fireEvent.click(count, { detail: 0 });
  fireEvent.doubleClick(
    screen.getByRole('button', { name: 'Scrum、行の映像を再生' }),
  );
  fireEvent.doubleClick(
    screen.getByRole('button', { name: 'Won、列の映像を再生' }),
  );
  expect(onReviewInstances.mock.calls).toEqual(
    Array.from({ length: 4 }, () => [[item]]),
  );
  fireEvent.contextMenu(count);
  expect(onDrilldown).toHaveBeenCalledWith('Scrum × Won', [item]);
});
