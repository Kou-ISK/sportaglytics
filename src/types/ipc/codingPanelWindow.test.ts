import { describe, expect, it } from 'vitest';
import type { CodingPanelWindowSyncPayload } from './codingPanelWindow';
import {
  isCodingPanelWindowCommand,
  isCodingPanelWindowSyncPayload,
} from './codingPanelWindow';

const syncPayload: CodingPanelWindowSyncPayload = {
  activeMode: 'code',
  customLayout: {
    id: 'layout-1',
    name: 'Code Panel',
    canvasWidth: 360,
    canvasHeight: 420,
    buttons: [
      {
        id: 'button-1',
        type: 'action',
        name: 'Team A Attack',
        x: 0,
        y: 0,
        width: 120,
        height: 40,
      },
    ],
    buttonLinks: [],
  },
  teamNames: ['Team A', 'Team B'],
  firstTeamName: 'Team A',
  activeActions: [
    {
      action: 'Attack',
      results: ['Success'],
      types: ['Open'],
    },
  ],
  activeRecordings: {
    'Team A Attack': { startTime: 12 },
  },
  primaryAction: 'Team A Attack',
  activeLabelButtons: {
    'button-2': true,
  },
  isRecording: true,
  labelSelections: {
    Attack: {
      Result: 'Success',
    },
  },
  selectedTimelineLabels: [{ group: 'Result', name: 'Success' }],
  statusMessage: null,
  hotkeys: [
    {
      id: 'play-pause',
      label: '再生/停止',
      key: 'Space',
    },
  ],
};

describe('codingPanelWindow IPC guards', () => {
  it('accepts valid sync payloads and commands', () => {
    expect(
      isCodingPanelWindowSyncPayload({
        ...syncPayload,
        codeWindowFilePath: '/tmp/window.stcw',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'request-sync',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'set-mode',
        mode: 'label',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'hotkey-key-down',
        hotkeyId: 'play-pause',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'custom-button-click',
        buttonId: 'button-1',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'layout-updated',
        layout: syncPayload.customLayout,
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'save-layout',
        layout: syncPayload.customLayout,
        saveAs: false,
        filePath: '/tmp/window.stcw',
      }),
    ).toBe(true);
    expect(
      isCodingPanelWindowCommand({
        type: 'label-select',
        actionName: 'Attack',
        groupName: 'Result',
        option: 'Success',
      }),
    ).toBe(true);
  });

  it('rejects invalid payloads and commands', () => {
    expect(
      isCodingPanelWindowSyncPayload({
        ...syncPayload,
        activeRecordings: { broken: { startTime: '12' } },
      }),
    ).toBe(false);
    expect(
      isCodingPanelWindowCommand({
        type: 'custom-button-click',
      }),
    ).toBe(false);
    expect(
      isCodingPanelWindowCommand({
        type: 'set-mode',
        mode: 'invalid',
      }),
    ).toBe(false);
  });
});
