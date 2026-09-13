import { useMemo } from 'react';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';

export const usePlaylistHotkeys = (paint = false): HotkeyConfig[] => {
  return useMemo<HotkeyConfig[]>(
    () =>
      [
        { id: 'play-pause', label: '再生/停止', key: 'Space', disabled: false },
        {
          id: 'reverse-playback-slow',
          label: '0.5倍速逆再生',
          key: 'Left',
          disabled: false,
        },
        {
          id: 'reverse-playback-2x',
          label: '2倍速逆再生',
          key: 'Shift+Left',
          disabled: false,
        },
        {
          id: 'reverse-playback-4x',
          label: '4倍速逆再生',
          key: 'Alt+Left',
          disabled: false,
        },
        {
          id: 'reverse-playback-6x',
          label: '6倍速逆再生',
          key: 'CommandOrControl+Left',
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
          key: 'CommandOrControl+Right',
          disabled: false,
        },
        {
          id: 'skip-forward-xlarge',
          label: '6倍速再生',
          key: 'Alt+Right',
          disabled: false,
        },
        {
          id: 'previous-item',
          label: '前のアイテム',
          key: 'CommandOrControl+Alt+Left',
          disabled: false,
        },
        {
          id: 'next-item',
          label: '次のアイテム',
          key: 'CommandOrControl+Alt+Right',
          disabled: false,
        },
        {
          id: 'delete-item',
          label: 'アイテム削除',
          key: 'Backspace',
          disabled: false,
        },
        {
          id: 'undo',
          label: '元に戻す',
          key: 'CommandOrControl+Z',
          disabled: false,
        },
        {
          id: 'redo',
          label: 'やり直す',
          key: 'CommandOrControl+Shift+Z',
          disabled: false,
        },
        {
          id: 'save',
          label: '保存',
          key: 'CommandOrControl+S',
          disabled: false,
        },
        {
          id: 'export',
          label: '書き出し',
          key: 'CommandOrControl+E',
          disabled: false,
        },
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
      ].filter(
        (hotkey) =>
          !paint ||
          ['save', 'export', 'undo', 'redo', 'play-pause'].includes(hotkey.id),
      ),
    [paint],
  );
};
