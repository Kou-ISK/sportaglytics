/* @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardFilterControl } from './DashboardFilterControl';
import { DashboardFilterEditor } from './DashboardFilterEditor';

afterEach(cleanup);

it('keeps the filter editor, selection, reset, and close available from the header', async () => {
  const update = vi.fn();
  const reset = vi.fn();
  render(
    <DashboardFilterControl
      filterCount={1}
      renderEditor={(onClose) => (
        <DashboardFilterEditor
          compactControlSx={{
            '& .MuiInputBase-input': { py: 0.75 },
            '& .MuiSelect-select': { py: 0.75 },
          }}
          dashboardFilters={{ team: 'Red' }}
          availableTeams={['Red', 'Blue']}
          availableActions={['スクラム']}
          availableGroups={['Result']}
          availableLabelValues={{ Result: ['Try'] }}
          updateDashboardFilters={update}
          onResetFilters={reset}
          onClose={onClose}
        />
      )}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'フィルタを編集' });
  expect(trigger.textContent).toContain('(1)');
  trigger.focus();
  fireEvent.click(trigger);
  expect(
    screen.getByRole('dialog', { name: '全体フィルター設定' }),
  ).toBeTruthy();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'チーム' }));
  fireEvent.click(screen.getByRole('option', { name: 'Blue' }));
  expect(update).toHaveBeenCalledWith({ team: 'Blue' });
  fireEvent.click(screen.getByRole('button', { name: 'すべてクリア' }));
  expect(reset).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});
