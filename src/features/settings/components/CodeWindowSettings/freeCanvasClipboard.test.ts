import { describe, expect, it } from 'vitest';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';
import {
  copyCodeWindowSelection,
  pasteCodeWindowSelection,
} from './freeCanvasClipboard';

const layout: CodeWindowLayout = {
  id: 'layout',
  name: 'Test',
  canvasWidth: 500,
  canvasHeight: 400,
  buttons: [
    {
      id: 'a',
      type: 'action',
      name: 'Attack',
      x: 20,
      y: 30,
      width: 100,
      height: 40,
    },
    {
      id: 'b',
      type: 'label',
      name: 'Result',
      labelValue: 'Good',
      x: 160,
      y: 90,
      width: 80,
      height: 40,
    },
    {
      id: 'c',
      type: 'action',
      name: 'Defence',
      x: 300,
      y: 30,
      width: 100,
      height: 40,
    },
  ],
  buttonLinks: [
    {
      id: 'ab',
      fromButtonId: 'a',
      toButtonId: 'b',
      type: 'activate',
    },
    {
      id: 'ac',
      fromButtonId: 'a',
      toButtonId: 'c',
      type: 'exclusive',
    },
  ],
};

describe('free canvas multi-selection clipboard', () => {
  it('copies selected buttons in layout order and internal links only', () => {
    const copied = copyCodeWindowSelection(layout, ['b', 'a']);

    expect(copied?.buttons.map((button) => button.id)).toEqual(['a', 'b']);
    expect(copied?.links.map((link) => link.id)).toEqual(['ab']);
  });

  it('preserves relative geometry and remaps every pasted id', () => {
    const copied = copyCodeWindowSelection(layout, ['a', 'b']);
    if (!copied) throw new Error('Expected copied selection');
    const ids = ['a-new', 'b-new', 'link-new'];
    const pasted = pasteCodeWindowSelection(layout, copied, {
      offsetX: 20,
      offsetY: 20,
      createId: () => ids.shift() ?? 'unexpected',
    });
    const [aNew, bNew] = pasted.layout.buttons.slice(-2);
    const pastedLink = pasted.layout.buttonLinks?.at(-1);

    expect(aNew?.id).toBe('a-new');
    expect(bNew?.id).toBe('b-new');
    expect(aNew?.x).toBe(40);
    expect(aNew?.y).toBe(50);
    expect((bNew?.x ?? 0) - (aNew?.x ?? 0)).toBe(140);
    expect((bNew?.y ?? 0) - (aNew?.y ?? 0)).toBe(60);
    expect(pastedLink).toMatchObject({
      id: 'link-new',
      fromButtonId: 'a-new',
      toButtonId: 'b-new',
      type: 'activate',
    });
    expect(pasted.selectedButtonIds).toEqual(['a-new', 'b-new']);
  });

  it('does not duplicate a link from the selected subset to an unselected button', () => {
    const copied = copyCodeWindowSelection(layout, ['a']);
    if (!copied) throw new Error('Expected copied selection');
    const pasted = pasteCodeWindowSelection(layout, copied, {
      createId: () => 'a-copy',
    });

    expect(copied.links).toEqual([]);
    expect(pasted.layout.buttonLinks).toEqual(layout.buttonLinks);
  });

  it('clamps the group as one unit at canvas bounds without distorting geometry', () => {
    const edgeLayout: CodeWindowLayout = {
      ...layout,
      buttons: [
        { ...layout.buttons[0]!, id: 'left', x: 360, y: 300 },
        { ...layout.buttons[1]!, id: 'right', x: 410, y: 330 },
      ],
      buttonLinks: [],
    };
    const copied = copyCodeWindowSelection(edgeLayout, ['left', 'right']);
    if (!copied) throw new Error('Expected copied selection');
    let id = 0;
    const pasted = pasteCodeWindowSelection(edgeLayout, copied, {
      offsetX: 100,
      offsetY: 100,
      createId: () => `new-${id++}`,
    });
    const [left, right] = pasted.layout.buttons.slice(-2);

    expect((right?.x ?? 0) - (left?.x ?? 0)).toBe(50);
    expect((right?.y ?? 0) - (left?.y ?? 0)).toBe(30);
    expect((right?.x ?? 0) + (right?.width ?? 0)).toBeLessThanOrEqual(500);
    expect((right?.y ?? 0) + (right?.height ?? 0)).toBeLessThanOrEqual(400);
  });

  it('keeps existing single-button copy and paste behavior', () => {
    const copied = copyCodeWindowSelection(layout, ['c']);
    if (!copied) throw new Error('Expected copied selection');
    const pasted = pasteCodeWindowSelection(layout, copied, {
      createId: () => 'c-new',
    });

    expect(pasted.selectedButtonIds).toEqual(['c-new']);
    expect(pasted.layout.buttons.at(-1)).toMatchObject({
      id: 'c-new',
      name: 'Defence',
      x: 320,
      y: 50,
    });
  });
});
