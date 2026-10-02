/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPanelToolbar } from './AnalysisPanelToolbar';

afterEach(cleanup);
describe('analysis mode navigation', () => {
  it.each([
    ['dashboard', 'ダッシュボード'],
    ['momentum', 'モメンタム'],
    ['matrix', 'クロス集計'],
    ['ai', 'AI分析'],
  ] as const)('retains the %s mode', (view, label) => {
    const changeView = vi.fn();
    render(
      <AnalysisPanelToolbar
        currentView={view === 'dashboard' ? 'matrix' : 'dashboard'}
        onChangeView={changeView}
        isExporting={false}
        exportAnchor={null}
        setExportAnchor={vi.fn()}
        onCloseExportMenu={vi.fn()}
        onCopySummary={vi.fn()}
        onExportPng={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(changeView).toHaveBeenCalledWith(view);
    expect(
      screen
        .getByRole('button', { name: 'エクスポート' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });
});
