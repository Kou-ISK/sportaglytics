import { useMemo } from 'react';
import type { HotkeyConfig } from '../../../types/Settings';

export const usePlaylistHotkeys = () => {
  return useMemo<HotkeyConfig[]>(
    () => [
      { id: 'play-pause', label: '再生/停止', key: 'Space', disabled: false },
      {
        id: 'skip-backward-medium',
        label: '5秒戻し',
        key: 'Left',
        disabled: false,
      },
      {
        id: 'skip-backward-large',
        label: '10秒戻し',
        key: 'Shift+Left',
        disabled: false,
      },
      {
        id: 'skip-forward-small',
        label: '0.5倍速再生',
        key: 'Right',
        disabled: false,
      },
      {
        id: 'skip-forward-medium',
        label: '2倍速再生',
        key: 'Shift+Right',
        disabled: false,
      },
      {
        id: 'skip-forward-large',
        label: '4倍速再生',
        key: 'Command+Right',
        disabled: false,
      },
      {
        id: 'skip-forward-xlarge',
        label: '6倍速再生',
        key: 'Option+Right',
        disabled: false,
      },
      {
        id: 'previous-item',
        label: '前のアイテム',
        key: 'Command+Left',
        disabled: false,
      },
      {
        id: 'next-item',
        label: '次のアイテム',
        key: 'Command+Option+Right',
        disabled: false,
      },
      {
        id: 'delete-item',
        label: 'アイテム削除',
        key: 'Backspace',
        disabled: false,
      },
      { id: 'undo', label: '元に戻す', key: 'Command+Z', disabled: false },
      {
        id: 'redo',
        label: 'やり直す',
        key: 'Command+Shift+Z',
        disabled: false,
      },
      { id: 'save', label: '保存', key: 'Command+S', disabled: false },
      { id: 'export', label: '書き出し', key: 'Command+E', disabled: false },
      {
        id: 'toggle-angle1',
        label: 'アングル1切替',
        key: 'Shift+1',
        disabled: false,
      },
      {
        id: 'toggle-angle2',
        label: 'アングル2切替',
        key: 'Shift+2',
        disabled: false,
      },
    ],
    [],
  );
};
