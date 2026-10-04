/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { getAppTheme } from '../../../../../../../theme';
import { AIAnalysisControlsPanel } from './AIAnalysisControlsPanel';
import { AIAnalysisConversationPanel } from './AIAnalysisConversationPanel';
import {
  reviewAiControls,
  reviewAiResult,
} from '../../fixtures/aiAnalysisReview';

afterEach(cleanup);
describe('AI analysis review interactions', () => {
  it('does not submit Japanese IME confirmation or Shift+Enter, and submits Enter once', () => {
    const generate = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <AIAnalysisControlsPanel
          {...reviewAiControls}
          handleGenerate={generate}
        />
      </ThemeProvider>,
    );
    const input = screen.getByRole('textbox', { name: '分析する質問' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(generate).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(generate).toHaveBeenCalledOnce();
  });
  it('retains template choice and changes the question via the callback', () => {
    const setQuestion = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <AIAnalysisControlsPanel
          {...reviewAiControls}
          setQuestion={setQuestion}
        />
      </ThemeProvider>,
    );
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: '質問テンプレート' }),
    );
    fireEvent.click(
      screen.getByRole('option', { name: '試合の重要場面を挙げる' }),
    );
    expect(setQuestion).toHaveBeenCalledWith('試合の重要場面を挙げる');
  });
  it('blocks new requests while running and retains cancellation', () => {
    const generate = vi.fn();
    const cancel = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <AIAnalysisControlsPanel
          {...reviewAiControls}
          generationStatus="running"
          handleGenerate={generate}
          handleCancelGeneration={cancel}
        />
      </ThemeProvider>,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: '分析する質問' }), {
      key: 'Enter',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: '実行中...' })
        .hasAttribute('disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '生成をキャンセル' }));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('jumps to the evidence exactly once from the result button', () => {
    const jump = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <AIAnalysisConversationPanel
          {...reviewAiResult}
          onJumpToSegment={jump}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '映像へジャンプ' }));
    expect(jump).toHaveBeenCalledOnce();
    expect(jump).toHaveBeenCalledWith(
      reviewAiResult.timelineMap.get('synthetic-0'),
    );
  });
});
