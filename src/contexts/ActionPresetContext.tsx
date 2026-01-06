import React, { createContext, useContext, useMemo } from 'react';
import { ActionList } from '../ActionList';
import type { ActionDefinition } from '../types/Settings';

const DEFAULT_ACTIONS: ActionDefinition[] = ActionList.map((item) => ({
  action: item.action,
  results: item.results,
  types: item.types,
}));

interface ActionPresetContextValue {
  /** すべてのアクション（activePresetのactionsを展開したもの） */
  activeActions: ActionDefinition[];
}

const ActionPresetContext = createContext<ActionPresetContextValue | undefined>(
  undefined,
);

export const useActionPreset = () => {
  const context = useContext(ActionPresetContext);
  if (!context) {
    throw new Error('useActionPreset must be used within ActionPresetProvider');
  }
  return context;
};

interface ActionPresetProviderProps {
  children: React.ReactNode;
}

export const ActionPresetProvider: React.FC<ActionPresetProviderProps> = ({
  children,
}) => {
  const activeActions = useMemo(() => DEFAULT_ACTIONS, []);

  const value = useMemo(
    () => ({
      activeActions,
    }),
    [activeActions],
  );

  return (
    <ActionPresetContext.Provider value={value}>
      {children}
    </ActionPresetContext.Provider>
  );
};
