/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';
import type { TimelineData, TimelineRow } from '../../../../types/timeline/core';
import { useTimelineActionPresentationSync } from './useTimelineActionPresentationSync';

const timeline: TimelineData[] = [
  {
    id: 'instance-1',
    actionName: 'Attack',
    startTime: 0,
    endTime: 10,
    memo: '',
    color: '#999999',
  },
];

const rows: TimelineRow[] = [
  { id: 'row-attack', name: 'Attack', color: '#999999' },
];

const createLayout = (color: string): CodeWindowLayout => ({
  id: 'cw',
  name: 'Test',
  canvasWidth: 800,
  canvasHeight: 600,
  buttons: [
    {
      id: 'attack',
      type: 'action',
      name: 'Attack',
      color,
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    },
  ],
});

describe('useTimelineActionPresentationSync', () => {
  it('synchronizes only colors owned by the active Code Window', () => {
    const onSynchronize = vi.fn();

    renderHook(() =>
      useTimelineActionPresentationSync({
        activeCodeWindow: createLayout('#123456'),
        timeline,
        rows,
        onSynchronize,
      }),
    );

    const colors = onSynchronize.mock.calls.at(-1)?.[0] as Map<string, string>;
    expect(colors.get('Attack')).toBe('#123456');
  });

  it('reacts immediately when the active button color changes', () => {
    const onSynchronize = vi.fn();
    const { rerender } = renderHook(
      ({ layout }) =>
        useTimelineActionPresentationSync({
          activeCodeWindow: layout,
          timeline,
          rows,
          onSynchronize,
        }),
      { initialProps: { layout: createLayout('#123456') } },
    );

    rerender({ layout: createLayout('#abcdef') });

    const colors = onSynchronize.mock.calls.at(-1)?.[0] as Map<string, string>;
    expect(colors.get('Attack')).toBe('#abcdef');
  });

  it('does not override a legacy row from a label-only button', () => {
    const onSynchronize = vi.fn();
    const layout: CodeWindowLayout = {
      ...createLayout('#123456'),
      buttons: [
        {
          id: 'attack-label',
          type: 'label',
          name: 'Attack',
          color: '#abcdef',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
      ],
    };

    renderHook(() =>
      useTimelineActionPresentationSync({
        activeCodeWindow: layout,
        timeline,
        rows,
        onSynchronize,
      }),
    );

    const colors = onSynchronize.mock.calls.at(-1)?.[0] as Map<string, string>;
    expect(colors.size).toBe(0);
  });
});
