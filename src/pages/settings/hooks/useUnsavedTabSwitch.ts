import { useState } from 'react';

export interface UnsavedTabConfig {
  hasUnsavedChanges: (tabIndex: number) => boolean;
}

export const useUnsavedTabSwitch = ({ hasUnsavedChanges }: UnsavedTabConfig) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [nextTab, setNextTab] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const requestTabChange = (newTab: number) => {
    if (hasUnsavedChanges(currentTab)) {
      setNextTab(newTab);
      setConfirmDialogOpen(true);
    } else {
      setCurrentTab(newTab);
    }
  };

  const confirmSwitch = () => {
    if (nextTab !== null) {
      setCurrentTab(nextTab);
      setNextTab(null);
    }
    setConfirmDialogOpen(false);
  };

  const cancelSwitch = () => {
    setNextTab(null);
    setConfirmDialogOpen(false);
  };

  return {
    currentTab,
    setCurrentTab,
    confirmDialogOpen,
    requestTabChange,
    confirmSwitch,
    cancelSwitch,
  };
};
