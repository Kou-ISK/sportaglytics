/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlaybackCachePanelView } from './PlaybackCachePanelView';

afterEach(cleanup);
it.each([true, false])(
  'keeps an explicit original recovery action reachable when open=%s',
  (open) => {
    const retry = vi.fn();
    render(
      <PlaybackCachePanelView
        open={open}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        error="原本への復旧は未確認です。"
        switching={false}
        onRetryOriginal={retry}
        cache={{
          status: {
            phase: 'ready',
            selected: 'original',
            progress: null,
            error: null,
          },
          estimate: null,
          canPrepare: true,
          paused: true,
          onPrepare: vi.fn(),
          onReuse: vi.fn(),
          onCancel: vi.fn(),
          onUseCache: vi.fn(),
          onUseOriginal: vi.fn(),
          onRetryCleanup: vi.fn(),
        }}
      >
        映像
      </PlaybackCachePanelView>,
    );
    fireEvent.click(screen.getByRole('button', { name: '原本を再読み込み' }));
    expect(retry).toHaveBeenCalledOnce();
  },
);
it('does not infer permission to reload from error wording', () => {
  render(
    <PlaybackCachePanelView
      open={false}
      onOpen={vi.fn()}
      onClose={vi.fn()}
      error="原本への復旧は未確認です。"
      switching={false}
      onRetryOriginal={null}
      cache={null}
    >
      映像
    </PlaybackCachePanelView>,
  );
  expect(screen.queryByRole('button', { name: '原本を再読み込み' })).toBeNull();
});
