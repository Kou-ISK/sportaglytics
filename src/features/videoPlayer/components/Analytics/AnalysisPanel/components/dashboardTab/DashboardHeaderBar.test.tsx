/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardHeaderBar } from './DashboardHeaderBar';
const props = {
  compactControlSx: {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
  },
  activeDashboardId: 'template-basic',
  dashboards: [
    { id: 'template-basic', name: '基本分析テンプレート', widgets: [] },
    { id: 'template-basic-1', name: '合成コピー', widgets: [] },
  ],
  isEditing: false,
  isSaving: false,
  onDashboardChange: vi.fn(),
  onStartEdit: vi.fn(),
  onAddWidget: vi.fn(),
  onCancelEdit: vi.fn(),
  onSave: vi.fn(),
  onOpenManagementMenu: vi.fn(),
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('offers explicit copy editing for the exact built-in ID without an unsavable add action', () => {
  const { rerender } = render(<DashboardHeaderBar {...props} />);
  expect(screen.getByText('読み取り専用')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'チャートを追加' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '複製して編集' }));
  expect(props.onStartEdit).toHaveBeenCalledOnce();
  rerender(
    <DashboardHeaderBar {...props} activeDashboardId="template-basic-1" />,
  );
  expect(screen.queryByText('読み取り専用')).toBeNull();
  expect(screen.getByRole('button', { name: '編集' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'チャートを追加' })).toBeTruthy();
});
it('keeps edit/save/cancel controls disabled during persistence', () => {
  render(
    <DashboardHeaderBar
      {...props}
      activeDashboardId="template-basic-1"
      isEditing
      isSaving
    />,
  );
  for (const name of ['保存中…', 'チャートを追加', 'キャンセル']) {
    const button = screen.getByRole('button', { name });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
  }
  expect(props.onSave).not.toHaveBeenCalled();
  expect(props.onCancelEdit).not.toHaveBeenCalled();
});
