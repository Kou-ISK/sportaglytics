import { describe, expect, it } from 'vitest';
import type { CodeWindowLayout } from '../../../types/settings/coreTypes';
import type { TimelineRow } from '../../../types/timeline/core';
import {
  buildActionPresentationMap,
  resolveActionPresentation,
} from './actionPresentation';

const codeWindow: CodeWindowLayout = {
  id: 'cw',
  name: 'Test',
  canvasWidth: 800,
  canvasHeight: 600,
  buttons: [
    {
      id: 'label-first',
      type: 'label',
      name: 'Attack',
      color: '#111111',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    },
    {
      id: 'action-first',
      type: 'action',
      name: 'Attack',
      color: '#123456',
      x: 0,
      y: 50,
      width: 100,
      height: 40,
    },
    {
      id: 'action-second',
      type: 'action',
      name: 'Attack',
      color: '#abcdef',
      x: 0,
      y: 100,
      width: 100,
      height: 40,
    },
  ],
};

const row: TimelineRow = {
  id: 'row-attack',
  name: 'Attack',
  color: '#999999',
};

describe('action presentation', () => {
  it('uses the first matching action button color in layout order', () => {
    expect(resolveActionPresentation('Attack', codeWindow, row)).toEqual({
      actionName: 'Attack',
      color: '#123456',
      source: 'code-window',
    });
  });

  it('ignores label button colors', () => {
    const layout: CodeWindowLayout = {
      ...codeWindow,
      buttons: [codeWindow.buttons[0]!],
    };

    expect(resolveActionPresentation('Attack', layout, row)).toEqual({
      actionName: 'Attack',
      color: '#999999',
      source: 'timeline-row',
    });
  });

  it('falls back to the existing row color when the action has no code color', () => {
    expect(resolveActionPresentation('Defence', codeWindow, row)).toEqual({
      actionName: 'Defence',
      color: '#999999',
      source: 'timeline-row',
    });
  });

  it('falls back to a deterministic default when neither source has a color', () => {
    const first = resolveActionPresentation('Defence', undefined, undefined);
    const second = resolveActionPresentation('Defence', undefined, undefined);

    expect(first.source).toBe('default');
    expect(first.color).toBe(second.color);
  });

  it('builds one presentation per action name', () => {
    const map = buildActionPresentationMap(
      ['Attack', 'Defence'],
      codeWindow,
      [row],
    );

    expect(map.get('Attack')?.color).toBe('#123456');
    expect(map.get('Defence')?.source).toBe('default');
  });
});
