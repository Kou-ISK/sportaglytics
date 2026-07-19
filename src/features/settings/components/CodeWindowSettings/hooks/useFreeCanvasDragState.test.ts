import { describe, expect, it } from 'vitest';
import { resolveButtonDragSelection } from './useFreeCanvasDragState';

describe('resolveButtonDragSelection', () => {
  it('keeps the full selection when dragging an already selected button', () => {
    expect(
      resolveButtonDragSelection({
        id: 'button-b',
        additive: false,
        selectedButtonIds: ['button-a', 'button-b', 'button-c'],
      }),
    ).toEqual(['button-a', 'button-b', 'button-c']);
  });

  it('selects only the dragged button when it is outside the current selection', () => {
    expect(
      resolveButtonDragSelection({
        id: 'button-d',
        additive: false,
        selectedButtonIds: ['button-a', 'button-b'],
      }),
    ).toEqual(['button-d']);
  });

  it('toggles a button when additive selection is requested', () => {
    expect(
      resolveButtonDragSelection({
        id: 'button-a',
        additive: true,
        selectedButtonIds: ['button-a', 'button-b'],
      }),
    ).toEqual(['button-b']);
  });
});
