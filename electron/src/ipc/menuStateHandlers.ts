import { Menu } from 'electron';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

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
    async (event, checked: unknown) => {
      if (
        !getValidatedEventSenderWindow(event) ||
        typeof checked !== 'boolean'
      ) {
        return false;
      }

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
};
