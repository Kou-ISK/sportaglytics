/* @vitest-environment jsdom */
import type { ComponentProps } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../theme';
import { TimelineFooter } from './TimelineFooter';

const renderFooter = (
  overrides: Partial<ComponentProps<typeof TimelineFooter>> = {},
): void => {
  render(
    <ThemeProvider theme={getAppTheme('dark')}>
      <TimelineFooter
        zoomScale={1}
        canZoomOut={false}
        canZoomIn
        onZoomOut={vi.fn()}
        onZoomIn={vi.fn()}
        onAddRow={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );
};

describe('TimelineFooter', () => {
  afterEach(cleanup);

  it('shows the current zoom percentage and disables zoom out at 100%', () => {
    renderFooter();

    expect(screen.getByText('100%')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'タイムラインを縮小' }).hasAttribute(
        'disabled',
      ),
    ).toBe(true);
  });

  it('invokes row and zoom actions', () => {
    const onAddRow = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    renderFooter({
      zoomScale: 1.5,
      canZoomOut: true,
      onAddRow,
      onZoomIn,
      onZoomOut,
    });

    fireEvent.click(screen.getByRole('button', { name: '行を追加' }));
    fireEvent.click(screen.getByRole('button', { name: 'タイムラインを縮小' }));
    fireEvent.click(screen.getByRole('button', { name: 'タイムラインを拡大' }));

    expect(screen.getByText('150%')).toBeTruthy();
    expect(onAddRow).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });
});
