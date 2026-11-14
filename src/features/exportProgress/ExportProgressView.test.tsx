// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ExportProgressView } from './ExportProgressView';

const base = {
  id: 'job',
  current: 1,
  total: 2,
  message: '進行中',
  startedAt: 1,
  updatedAt: 2,
};
it('renders the Main-provided encoder failure in error details', () => {
  const error = 'FfmpegExecutionError: H.264 エンコーダーを利用できない可能性があります（VideoToolbox -12908; ffmpeg exited with code 187）';
  const { unmount } = render(<ExportProgressView state={{ ...base, status: 'failed', error }} now={3} pending={false} notice={null} onCancel={() => undefined} onClose={() => undefined} />);
  expect(screen.getByText(error)).toBeTruthy();
  expect(screen.getByText('エラー詳細を表示')).toBeTruthy();
  unmount();
});
it('provides one cancel action while running and disables it while the request is pending', () => {
  const cancel = vi.fn();
  const { rerender } = render(
    <ExportProgressView
      state={{ ...base, status: 'running' }}
      now={3}
      pending={false}
      notice={null}
      onCancel={cancel}
      onClose={() => undefined}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '書き出しを中止' }));
  expect(cancel).toHaveBeenCalledOnce();
  rerender(
    <ExportProgressView
      state={{ ...base, status: 'running' }}
      now={3}
      pending
      notice={null}
      onCancel={cancel}
      onClose={() => undefined}
    />,
  );
  const button = screen.getByRole('button', { name: '書き出しを中止' });
  expect(button).toBeInstanceOf(HTMLButtonElement);
  expect(button.hasAttribute('disabled')).toBe(true);
});
it('shows cancellation in progress and allows close only after completion', () => {
  const { rerender } = render(
    <ExportProgressView
      state={{ ...base, status: 'cancelling' }}
      now={3}
      pending={false}
      notice={null}
      onCancel={() => undefined}
      onClose={() => undefined}
    />,
  );
  expect(screen.getByText('書き出しを中止中')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull();
  rerender(
    <ExportProgressView
      state={{ ...base, status: 'cancelled', message: '1件は保存済み' }}
      now={3}
      pending={false}
      notice={null}
      onCancel={() => undefined}
      onClose={() => undefined}
    />,
  );
  expect(screen.getByText('1件は保存済み')).toBeTruthy();
  expect(screen.getByRole('button', { name: '閉じる' })).toBeTruthy();
});

it('shows retained locations locally and does not suggest retry for uncertain publication', () => {
  render(
    <ExportProgressView
      state={{
        ...base,
        status: 'failed',
        message: '結果不明',
        retainedDirectories: [
          {
            id: 'record',
            path: '/example/.sportag-export-example',
            purpose: 'final-staging',
            device: '1',
            inode: '2',
            reason: 'publication-uncertain',
            writerStatus: 'unknown',
          },
        ],
      }}
      now={3}
      pending={false}
      notice={null}
      onCancel={() => undefined}
      onClose={() => undefined}
    />,
  );
  expect(screen.getByText('/example/.sportag-export-example')).toBeTruthy();
  expect(screen.getByText(/再試行しないでください/)).toBeTruthy();
  expect(screen.queryByText(/もう一度書き出してください/)).toBeNull();
});

it('shows retained and unknown locations after cancellation', () => {
  render(<ExportProgressView state={{ ...base, status: 'cancelled', retainedLocationUnknown: true, retainedDirectories: [{ id: 'one', path: '/example/one', purpose: 'native-temp', device: '1', inode: '2', reason: 'retained-after-failure', writerStatus: 'unknown' }] }} now={3} pending={false} notice={null} onCancel={() => undefined} onClose={() => undefined} />);
  expect(screen.getByText('/example/one')).toBeTruthy();
  expect(screen.getAllByText(/場所を確認できません/).length).toBeGreaterThan(0);
});

it('shows that output was saved while retained cleanup is unresolved', () => {
  render(<ExportProgressView state={{ ...base, status: 'completed', retainedLocationUnknown: true, message: '出力は保存されましたが、一時データの後処理を確認できません' }} now={3} pending={false} notice={null} onCancel={() => undefined} onClose={() => undefined} />);
  expect(screen.getByText('出力は保存されました')).toBeTruthy();
  expect(screen.getAllByText(/場所を確認できません/).length).toBeGreaterThan(0);
});
