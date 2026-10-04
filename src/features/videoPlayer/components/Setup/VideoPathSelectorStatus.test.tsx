/* @vitest-environment jsdom */
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../theme';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import type { VideoPathSelectorViewProps } from './VideoPathSelectorView';

const scrollIntoView = vi.fn();
const props: VideoPathSelectorViewProps = {
  showWelcome: true,
  dragState: { isDragging: false, isValidDrop: false },
  dragHandlers: {},
  recentPackages: [],
  onOpenPackage: vi.fn(),
  onOpenWizard: vi.fn(),
  onOpenRecentPackage: vi.fn(),
  onRemoveRecentPackage: vi.fn(),
};
const view = (
  updates: Partial<VideoPathSelectorViewProps>,
): React.ReactElement => (
  <ThemeProvider theme={getAppTheme('dark')}>
    <VideoPathSelectorView {...props} {...updates} />
  </ThemeProvider>
);

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('startup status recovery', () => {
  it('reveals loading before the actions without taking focus, then restores access on cancel', () => {
    const { rerender } = render(view({}));
    const open = screen.getByRole('button', { name: 'パッケージを開く' });
    open.focus();
    rerender(view({ busy: true }));
    const status =
      screen.getByText('パッケージを読み込んでいます…').parentElement!;
    expect(
      status.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(scrollIntoView.mock.contexts).toContain(status);
    expect(document.activeElement).toBe(open);
    // aria-busy must not suppress the live status announcement.
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(open.hasAttribute('disabled')).toBe(true);

    rerender(view({}));
    expect(document.activeElement).toBe(open);
    expect(open.hasAttribute('disabled')).toBe(false);
  });

  it('focuses and reveals a failure again after retry, but does not refocus unchanged details', () => {
    const onRetry = vi.fn();
    const failure = {
      error: '読み込めません',
      errorDetails: 'fixtures/missing.stpkg',
      onRetry,
    };
    const { rerender } = render(view({ busy: true }));
    rerender(view(failure));
    const alert = screen.getByRole('alert');
    expect(document.activeElement).toBe(alert);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(alert);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(
      alert.compareDocumentPosition(
        screen.getByRole('button', { name: 'パッケージを開く' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const details = screen.getByText('詳細を表示');
    details.focus();
    rerender(view({ ...failure, searchQuery: 'Synthetic' }));
    expect(document.activeElement).toBe(details);
    fireEvent.click(screen.getByRole('button', { name: 'もう一度開く' }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(view({ busy: true }));
    rerender(view(failure));
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole('alert'));
  });

  it('returns focus to Open when the error is dismissed', () => {
    const onDismissError = vi.fn();
    const { rerender } = render(
      view({ error: '読み込めません', onDismissError }),
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onDismissError).toHaveBeenCalledOnce();
    rerender(view({}));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'パッケージを開く' }),
    );
  });
});
