import { describe, expect, it } from 'vitest';
import {
  createEmptyCodeWindowLayout,
  getCodeWindowNameFromFilePath,
} from './createEmptyCodeWindowLayout';

describe('createEmptyCodeWindowLayout', () => {
  it('creates an independent empty code window document layout', () => {
    const first = createEmptyCodeWindowLayout();
    const second = createEmptyCodeWindowLayout();

    expect(first).toMatchObject({
      name: '新規コードウィンドウ',
      canvasWidth: 360,
      canvasHeight: 400,
      buttons: [],
      buttonLinks: [],
      splitByTeam: false,
    });
    expect(first.id).not.toBe(second.id);
  });

  it('derives the document name from macOS and Windows paths', () => {
    expect(getCodeWindowNameFromFilePath('/tmp/Attack.stcw')).toBe('Attack');
    expect(getCodeWindowNameFromFilePath('C:\\video\\Defence.STCW')).toBe(
      'Defence',
    );
  });
});
