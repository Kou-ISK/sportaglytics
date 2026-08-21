/* @vitest-environment jsdom */
import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../theme';
import { ErrorSnackbar } from './ErrorSnackbar';

describe('ErrorSnackbar', () => {
  it('shows a user message, recovery guidance, and expandable details', () => {
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <ErrorSnackbar
          error={{
            type: 'sync',
            message: '音声同期に失敗しました。',
            recoveryHint: '音声を確認してから再実行してください。',
            detail: 'ffmpeg exited with code 1',
          }}
          onClose={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('音声同期エラー')).toBeTruthy();
    expect(screen.getByText('音声同期に失敗しました。')).toBeTruthy();
    expect(screen.getByText('音声を確認してから再実行してください。')).toBeTruthy();

    fireEvent.click(screen.getByText('エラー詳細を表示'));
    expect(screen.getByText('ffmpeg exited with code 1')).toBeTruthy();
  });
});
