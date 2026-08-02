/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CodeWindowButton } from '../../../../../types/settings/coreTypes';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';
import { useActionButtonInteractions } from './useActionButtonInteractions';
import { useCodePanelInteractions } from './useCodePanelInteractions';
import { useLabelButtonInteractions } from './useLabelButtonInteractions';

const noopRecordingSetter: Dispatch<
  SetStateAction<Record<string, ActiveRecordingSession>>
> = () => undefined;
const noopLabelUpdater = (
  _updater:
    | LabelSelectionsMap
    | ((previous: LabelSelectionsMap) => LabelSelectionsMap),
): void => undefined;
const noopPrimarySetter: Dispatch<SetStateAction<string | null>> = () =>
  undefined;

describe('code window link notifications', () => {
  it('activates an action link without showing a status alert', () => {
    const setWarning = vi.fn<(message: string | null) => void>();
    const recentActionsRef: MutableRefObject<string[]> = { current: [] };
    const { result } = renderHook(() =>
      useActionButtonInteractions({
        activeMode: 'code',
        effectiveLinks: [
          { from: 'タックル', to: 'ポゼッション', type: 'activate' },
        ],
        isSameActionName: (left, right) => left === right,
        resolveRecordingKey: () => undefined,
        getCurrentTime: () => 12,
        setActiveRecordings: noopRecordingSetter,
        updateLabelSelections: noopLabelUpdater,
        setPrimaryAction: noopPrimarySetter,
        setWarning,
        completeRecording: vi.fn(),
        recentActionsRef,
        getButtonColorByName: () => undefined,
      }),
    );

    result.current.handleActionClick('帝京', {
      action: 'タックル',
      types: [],
      results: [],
      groups: [],
    });

    expect(setWarning).toHaveBeenLastCalledWith(null);
    expect(
      setWarning.mock.calls.some(([message]) => typeof message === 'string'),
    ).toBe(false);
  });

  it('activates a label link without showing a status alert', () => {
    const setWarning = vi.fn<(message: string | null) => void>();
    const activeRecordingsRef: MutableRefObject<
      Record<string, ActiveRecordingSession>
    > = { current: {} };
    const setActiveLabelButtons: Dispatch<
      SetStateAction<Record<string, boolean>>
    > = () => undefined;
    const button: CodeWindowButton = {
      id: 'label-button',
      type: 'label',
      name: '結果',
      labelValue: '成功',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      team: 'shared',
    };
    const { result } = renderHook(() =>
      useLabelButtonInteractions({
        activeMode: 'code',
        hasSelectedTimelineItems: false,
        teamNames: ['帝京', '筑波'],
        effectiveLinks: [
          { from: '結果', to: 'ポゼッション', type: 'activate' },
        ],
        isSameActionName: (left, right) => left === right,
        resolveRecordingKey: () => undefined,
        getCurrentTime: () => 12,
        setActiveRecordings: noopRecordingSetter,
        updateLabelSelections: noopLabelUpdater,
        setPrimaryAction: noopPrimarySetter,
        setWarning,
        completeRecording: vi.fn(),
        activeRecordingsRef,
        setActiveLabelButtons,
        getButtonColorByName: () => undefined,
        handleApplyLabel: vi.fn(),
      }),
    );

    result.current.handleLabelButtonClick(button, '結果', '成功');

    expect(setWarning).toHaveBeenLastCalledWith(null);
    expect(
      setWarning.mock.calls.some(([message]) => typeof message === 'string'),
    ).toBe(false);
  });

  it('ignores an unresolved team placeholder without showing an alert', () => {
    const setWarning = vi.fn<(message: string | null) => void>();
    const recentActionsRef: MutableRefObject<string[]> = { current: [] };
    const activeRecordingsRef: MutableRefObject<
      Record<string, ActiveRecordingSession>
    > = { current: {} };
    const setActiveLabelButtons: Dispatch<
      SetStateAction<Record<string, boolean>>
    > = () => undefined;
    const button: CodeWindowButton = {
      id: 'team-action',
      type: 'action',
      name: '${Team1} タックル',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      team: 'team1',
    };
    const { result } = renderHook(() =>
      useCodePanelInteractions({
        activeMode: 'code',
        activeActions: [],
        teamNames: [],
        teamContext: { team1Name: '', team2Name: '' },
        selectedIds: [],
        customLayout: {
          id: 'layout',
          name: 'Layout',
          canvasWidth: 400,
          canvasHeight: 300,
          buttons: [button],
          buttonLinks: [],
        },
        effectiveLinks: [],
        isSameActionName: (left, right) => left === right,
        resolveRecordingKey: () => undefined,
        getCurrentTime: () => 12,
        setActiveRecordings: noopRecordingSetter,
        updateLabelSelections: noopLabelUpdater,
        setPrimaryAction: noopPrimarySetter,
        setWarning,
        completeRecording: vi.fn(),
        recentActionsRef,
        activeRecordingsRef,
        setActiveLabelButtons,
      }),
    );

    result.current.handleCustomButtonClick(button);

    expect(setWarning).toHaveBeenLastCalledWith(null);
    expect(
      setWarning.mock.calls.some(([message]) => typeof message === 'string'),
    ).toBe(false);
  });
});
