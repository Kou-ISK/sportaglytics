/* @vitest-environment jsdom */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AngleSidebar } from './AngleSidebar';
import type { AngleSelection } from '../../types';

afterEach(cleanup);

it('reveals the selected angle and keeps the eight-angle add limit', () => {
  const angles: AngleSelection[] = Array.from({ length: 8 }, (_, index) => ({
    id: `angle-${index + 1}`,
    name: `アングル ${index + 1}`,
    clips: [
      {
        id: `clip-${index + 1}`,
        sourceKind: 'local',
        source: `fixtures/synthetic-${index + 1}.mp4`,
        gapBeforeSeconds: 0,
      },
    ],
  }));
  const onSelectAngle = vi.fn();
  const onAddAngle = vi.fn();
  const props = {
    angles,
    selectedAngleId: 'angle-1',
    onSelectAngle,
    onAddAngle,
  };
  const { rerender } = render(<AngleSidebar {...props} />);
  const list = screen.getByRole('list', { name: 'アングル一覧' });
  const first = within(list).getByRole('button', {
    name: 'アングル 1 1本 メイン',
  });
  const last = within(list).getByRole('button', { name: 'アングル 8 1本' });
  expect(first.getAttribute('aria-current')).toBe('true');
  expect(
    screen
      .getByRole('button', { name: 'アングルを追加' })
      .hasAttribute('disabled'),
  ).toBe(true);
  last.scrollIntoView = vi.fn();
  fireEvent.click(last);
  expect(onSelectAngle).toHaveBeenCalledWith('angle-8');
  rerender(<AngleSidebar {...props} selectedAngleId="angle-8" />);
  expect(last.getAttribute('aria-current')).toBe('true');
  expect(last.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

  rerender(<AngleSidebar {...props} angles={angles.slice(0, 7)} />);
  fireEvent.click(screen.getByRole('button', { name: 'アングルを追加' }));
  expect(onAddAngle).toHaveBeenCalledOnce();
});
