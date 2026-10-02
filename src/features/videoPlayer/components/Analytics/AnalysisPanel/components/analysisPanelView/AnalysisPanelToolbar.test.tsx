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
    fireEvent.click(screen.getByRole('tab', { name: label }));
    expect(changeView).toHaveBeenCalledWith(view);
    expect(
      screen
        .getByRole('button', { name: 'エクスポート' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('keeps all modes visible but disabled during export', () => {
    const changeView = vi.fn();
    render(
      <AnalysisPanelToolbar
        currentView="dashboard"
        onChangeView={changeView}
        isExporting
        exportAnchor={null}
        setExportAnchor={vi.fn()}
        onCloseExportMenu={vi.fn()}
        onCopySummary={vi.fn()}
        onExportPng={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.hasAttribute('disabled')).toBe(true);
      fireEvent.click(tab);
    }
    expect(changeView).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: 'エクスポート' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('moves keyboard focus between tabs and preserves all export actions', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);
    const copy = vi.fn();
    const png = vi.fn();
    const pdf = vi.fn();
    const props = {
      currentView: 'dashboard' as const,
      onChangeView: vi.fn(),
      isExporting: false,
      exportAnchor: null,
      setExportAnchor: vi.fn(),
      onCloseExportMenu: vi.fn(),
      onCopySummary: copy,
      onExportPng: png,
      onExportPdf: pdf,
    };
    const { rerender } = render(<AnalysisPanelToolbar {...props} />);
    const dashboard = screen.getByRole('tab', { name: 'ダッシュボード' });
    dashboard.focus();
    fireEvent.keyDown(dashboard, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'モメンタム' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }));
    expect(props.setExportAnchor).toHaveBeenCalledOnce();
    rerender(<AnalysisPanelToolbar {...props} exportAnchor={anchor} />);
    fireEvent.click(
      screen.getByRole('menuitem', { name: '構造化サマリーをコピー' }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: '現在タブをPNGで保存（全内容）' }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: '分析レポートをPDFで保存' }),
    );
    expect(copy).toHaveBeenCalledOnce();
    expect(png).toHaveBeenCalledOnce();
    expect(pdf).toHaveBeenCalledOnce();
    anchor.remove();
  });
});
