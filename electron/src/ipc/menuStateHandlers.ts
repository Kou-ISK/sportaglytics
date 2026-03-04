import { Menu } from 'electron';
import { registerHandleWithAliases } from './registerHandleWithAliases';

let isRegistered = false;

const setMenuCheckedState = (id: string, checked: boolean): boolean => {
  const menu = Menu.getApplicationMenu();
  const item = menu?.getMenuItemById(id);
  if (item) {
    item.checked = checked;
  }
  return true;
};

export const registerMenuStateHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'menu:set-manual-mode-checked',
    ['set-manual-mode-checked'],
    async (_event, checked: boolean) => {
      try {
        const updated = setMenuCheckedState('toggle-manual-mode', checked);
        console.log(`手動モードが${checked ? 'オン' : 'オフ'}になりました`);
        return updated;
      } catch (error) {
        console.error('set-manual-mode-checked error:', error);
        return false;
      }
    },
  );

  registerHandleWithAliases(
    'menu:set-label-mode-checked',
    ['set-label-mode-checked'],
    async (_event, checked: boolean) => {
      try {
        const updated = setMenuCheckedState('toggle-label-mode', checked);
        console.log(`ラベルモードが${checked ? 'オン' : 'オフ'}になりました`);
        return updated;
      } catch (error) {
        console.error('set-label-mode-checked error:', error);
        return false;
      }
    },
  );
};
