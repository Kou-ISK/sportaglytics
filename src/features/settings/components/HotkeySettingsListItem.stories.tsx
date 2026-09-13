import type { Meta, StoryObj } from '@storybook/react-vite';
import { HotkeySettingsListItem } from './HotkeySettingsListItem';

const meta = {
  title: 'Workspace/Settings/Hotkey',
  component: HotkeySettingsListItem,
  args: {
    hotkey: { id: 'undo', label: '元に戻す', key: 'CommandOrControl+Z' },
    shortcutLabel: 'Ctrl+Z',
    isEditing: false,
    capturedKey: '',
    conflictWarning: null,
    onEditStart: () => {},
    onEditSave: () => {},
    onEditCancel: () => {},
  },
} satisfies Meta<typeof HotkeySettingsListItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Windows: Story = {};
export const Mac: Story = { args: { shortcutLabel: '⌘+Z' } };
export const CapturingWindows: Story = {
  args: { isEditing: true, capturedKey: 'Ctrl+Shift+Z' },
};
export const Conflict: Story = {
  args: {
    isEditing: true,
    capturedKey: 'Ctrl+S',
    conflictWarning: '"Ctrl+S" はシステムで使用されているため設定できません',
  },
};
