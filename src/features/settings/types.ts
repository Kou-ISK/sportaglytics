export interface SettingsTabHandle {
  hasUnsavedChanges: () => boolean;
  save?: () => Promise<boolean>;
}
