// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaylistNoteEditor } from './PlaylistNoteEditor';

afterEach(cleanup);
describe('playlist note editing', () => {
  it('commits multiline text once and keeps Delete, spaces and arrows inside the editor', () => {
    const onCommit = vi.fn();
    const parentKey = vi.fn();
    render(
      <div onKeyDown={parentKey}>
        <PlaylistNoteEditor note="Before" onCommit={onCommit} />
      </div>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '外側へ\n早くサポート' } });
    for (const key of ['Backspace', 'Delete', ' ', 'ArrowRight'])
      fireEvent.keyDown(input, { key });
    expect(parentKey).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(
      '外側へ\n早くサポート',
      undefined,
    );
  });
  it('cancels without overwriting the saved note, including during blur', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <PlaylistNoteEditor
        note="Before"
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Discard' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(input).toHaveProperty('value', 'Before');
  });
  it('uses Control+Tab and Shift+Control+Tab to commit and move between notes', () => {
    const onCommit = vi.fn();
    render(<PlaylistNoteEditor note="" onCommit={onCommit} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Next' } });
    fireEvent.keyDown(input, { key: 'Tab', ctrlKey: true });
    expect(onCommit).toHaveBeenLastCalledWith('Next', 1);
    fireEvent.change(input, { target: { value: 'Previous' } });
    fireEvent.keyDown(input, { key: 'Tab', ctrlKey: true, shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith('Previous', -1);
  });
  it('does not commit during Japanese IME composition', () => {
    const onCommit = vi.fn();
    render(<PlaylistNoteEditor note="" onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      ctrlKey: true,
      isComposing: true,
    });
    expect(onCommit).not.toHaveBeenCalled();
  });
});

it('adds a newline with Control+Enter and commits compact cells with Enter', () => {
  const onCommit = vi.fn();
  render(<PlaylistNoteEditor compact note="First" onCommit={onCommit} />);
  const input = screen.getByRole('textbox');
  if (!(input instanceof HTMLTextAreaElement))
    throw new Error('Expected a note textarea');
  input.focus();
  input.setSelectionRange(5, 5);
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
  expect(onCommit).not.toHaveBeenCalled();
  expect(input).toHaveProperty('value', 'First\n');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onCommit).toHaveBeenCalledWith('First\n', undefined);
});
