import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';

export const createEmptyCodeWindowLayout = (): CodeWindowLayout => ({
  id: globalThis.crypto.randomUUID(),
  name: '新規コードウィンドウ',
  canvasWidth: 360,
  canvasHeight: 400,
  buttons: [],
  buttonLinks: [],
  splitByTeam: false,
});

export const getCodeWindowNameFromFilePath = (filePath: string): string => {
  const fileName = filePath.split(/[\\/]/).pop() ?? '';
  const name = fileName.replace(/\.stcw$/i, '').trim();
  return name || '新規コードウィンドウ';
};
