/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlaybackCacheView } from './PlaybackCacheView';
import type { PlaybackCacheViewProps } from './PlaybackCacheView';

afterEach(cleanup);
it('offers explicit reuse separately from creating media and reports missing candidates', () => {
  const onReuse = vi.fn();
  const onPrepare = vi.fn();
  render(
    <PlaybackCacheView
      status={{
        phase: 'failed',
        selected: 'original',
        progress: null,
        error: 'missing',
      }}
      estimate={null}
      canPrepare
      paused
      onReuse={onReuse}
      onPrepare={onPrepare}
      onCancel={vi.fn()}
      onUseOriginal={vi.fn()}
      onUseCache={vi.fn()}
      onRetryCleanup={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '保存済みコピーを確認' }));
  expect(onReuse).toHaveBeenCalledOnce();
  expect(onPrepare).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain(
    '保存済みコピーがありません',
  );
});
it('keeps the user informed and blocks regeneration while child exit is unconfirmed', () => {
  render(
    <PlaybackCacheView
      status={{
        phase: 'cancelling',
        progress: null,
        selected: 'original',
        error: 'stop',
      }}
      estimate={null}
      canPrepare
      paused
      onPrepare={vi.fn()}
      onReuse={vi.fn()}
      onCancel={vi.fn()}
      onUseOriginal={vi.fn()}
      onUseCache={vi.fn()}
      onRetryCleanup={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert').textContent).toContain(
    '終了を確認できていません',
  );
  expect(screen.getByRole('status').textContent).toContain(
    '終了を待っています',
  );
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
it('keeps cancellation and original fallback available, but requires pause before adopting a ready copy', () => {
  const props: PlaybackCacheViewProps = {
    status: {
      phase: 'converting',
      progress: 0.4,
      selected: 'original',
      error: null,
    },
    estimate: { seconds: 4500, bytes: 2000000000 },
    canPrepare: true,
    paused: false,
    onPrepare: vi.fn(),
    onReuse: vi.fn(),
    onCancel: vi.fn(),
    onUseOriginal: vi.fn(),
    onUseCache: vi.fn(),
    onRetryCleanup: vi.fn(),
  };
  const { rerender } = render(<PlaybackCacheView {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
  expect(props.onCancel).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole('button', { name: '再生用コピーを使う' }),
  ).toBeNull();
  const ready = {
    ...props,
    status: { ...props.status, phase: 'ready' as const, progress: null },
  };
  rerender(<PlaybackCacheView {...ready} />);
  expect(
    screen
      .getByRole('button', { name: '再生用コピーを使う' })
      .hasAttribute('disabled'),
  ).toBe(true);
  rerender(<PlaybackCacheView {...ready} paused />);
  fireEvent.click(screen.getByRole('button', { name: '再生用コピーを使う' }));
  expect(props.onUseCache).toHaveBeenCalledOnce();
  rerender(
    <PlaybackCacheView
      {...ready}
      status={{ ...ready.status, selected: 'cache' }}
      paused
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '原本へ戻す' }));
  expect(props.onUseOriginal).toHaveBeenCalledOnce();
});

it('reports failure and offers cleanup instead of starting an overlapping conversion', () => {
  const onRetryCleanup = vi.fn();
  render(
    <PlaybackCacheView
      status={{
        phase: 'failed',
        progress: null,
        selected: 'original',
        error: 'cleanup',
      }}
      estimate={null}
      canPrepare
      paused
      onRetryCleanup={onRetryCleanup}
      onPrepare={vi.fn()}
      onReuse={vi.fn()}
      onCancel={vi.fn()}
      onUseOriginal={vi.fn()}
      onUseCache={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert').textContent).toContain('片付け');
  expect(
    screen.queryByRole('button', { name: '再生用コピーを作成' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '片付けを再試行' }));
  expect(onRetryCleanup).toHaveBeenCalledOnce();
});
