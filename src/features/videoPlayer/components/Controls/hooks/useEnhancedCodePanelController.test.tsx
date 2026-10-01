// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CodingPanelWindowCommand } from '../../../../../types/ipc/codingPanelWindow';
import { useEnhancedCodePanelController } from './useEnhancedCodePanelController';
const state = vi.hoisted(() => ({
  command: (_command: CodingPanelWindowCommand): void => {},
  settings: {},
}));
vi.mock('../../../../../contexts/ActionPresetContext', () => ({
  useActionPreset: () => ({
    activeActions: [{ action: 'Attack', types: [], results: [], groups: [] }],
  }),
}));
vi.mock('../../../../../hooks/useSettings', () => ({
  useSettings: () => ({ settings: state.settings }),
}));
vi.mock('./useCodingPanelCommands', () => ({
  useCodingPanelCommands: (
    callback: (command: CodingPanelWindowCommand) => void,
  ): void => {
    state.command = callback;
  },
}));
afterEach(cleanup);
it('blocks coding commands during read failure and does not carry a pending recording into the next loaded document', () => {
  const add = vi.fn();
  const props = { codingTime: 10, documentEditable: true, documentRevision: 1 };
  const hook = renderHook(
    (input) =>
      useEnhancedCodePanelController({
        ...input,
        addTimelineData: add,
        teamNames: ['Coral'],
      }),
    { initialProps: props },
  );
  act(() => hook.result.current.triggerAction('Coral', 'Attack'));
  expect(hook.result.current.viewProps.isRecording).toBe(true);
  hook.rerender({ ...props, documentEditable: false, documentRevision: 2 });
  expect(hook.result.current.viewProps.isRecording).toBe(false);
  act(() => {
    hook.result.current.triggerAction('Coral', 'Attack');
    state.command({
      type: 'action-click',
      teamName: 'Coral',
      actionName: 'Attack',
    });
    state.command({
      type: 'label-select',
      actionName: 'Attack',
      groupName: 'Result',
      option: 'Ghost',
    });
  });
  expect(add).not.toHaveBeenCalled();
  expect(hook.result.current.viewProps.labelSelections).toEqual({});
  hook.rerender({
    codingTime: 20,
    documentEditable: true,
    documentRevision: 2,
  });
  act(() => hook.result.current.triggerAction('Coral', 'Attack'));
  expect(add).not.toHaveBeenCalled();
  hook.rerender({
    codingTime: 22,
    documentEditable: true,
    documentRevision: 2,
  });
  act(() => hook.result.current.triggerAction('Coral', 'Attack'));
  expect(add).toHaveBeenCalledTimes(1);
  expect(add.mock.calls[0][1]).toBe(20);
});
