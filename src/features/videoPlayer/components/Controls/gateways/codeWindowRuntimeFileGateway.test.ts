import { describe, expect, it } from 'vitest';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/settings/coreTypes';
import {
  createCodeWindowFilePayload,
  isCodeWindowFilePayload,
} from './codeWindowRuntimeFileGateway';

const button: CodeWindowButton = {
  id: 'scrum',
  name: 'Scrum',
  type: 'action',
  x: 10,
  y: 10,
  width: 100,
  height: 40,
  leadTimeSeconds: 1,
  lagTimeSeconds: 2,
};

const layout = (...buttons: CodeWindowButton[]): CodeWindowLayout => ({
  id: 'set-piece',
  name: 'Set piece',
  canvasWidth: 800,
  canvasHeight: 600,
  buttons,
});

describe('Code Window file capability version', () => {
  it('keeps manual timing and ordinary labels shareable with version 1', () => {
    expect(createCodeWindowFilePayload(layout())).toMatchObject({ version: 1 });
    const original = layout(button, {
      ...button,
      id: 'result',
      type: 'label',
      labelValue: 'Won',
    });
    expect(createCodeWindowFilePayload(original)).toEqual({
      version: 1,
      layout: original,
    });
  });

  it('marks either recording or label behavior that an old app would ignore', () => {
    for (const configured of [
      { ...button, recordingMode: 'single-click', extendOnRepeat: true },
      {
        ...button,
        id: 'result',
        type: 'label',
        labelValue: 'Won',
        labelTargetMode: 'linked',
      },
    ] satisfies CodeWindowButton[]) {
      const file = createCodeWindowFilePayload(layout(configured));
      expect(file.version).toBe(2);
      const serialized: unknown = JSON.parse(JSON.stringify(file));
      expect(isCodeWindowFilePayload(serialized)).toBe(true);
      expect(serialized).toEqual(file);
    }
  });

  it('opens either supported version but does not accept a future envelope', () => {
    for (const version of [1, 2]) {
      expect(isCodeWindowFilePayload({ version, layout: layout(button) })).toBe(
        true,
      );
    }
    expect(
      isCodeWindowFilePayload({ version: 3, layout: layout(button) }),
    ).toBe(false);
  });
});
