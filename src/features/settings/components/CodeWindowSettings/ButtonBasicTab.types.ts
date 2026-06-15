import type React from 'react';
import type { CodeWindowButton } from '../../../../types/settings/coreTypes';

export type LabelGroup = { groupName: string; options: string[] };

export interface ButtonBasicTabProps {
  button: CodeWindowButton;
  availableActions: string[];
  availableLabelGroups: LabelGroup[];
  currentLabelGroup?: LabelGroup;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  capturedHotkey: string;
  isCapturingHotkey: boolean;
  setIsCapturingHotkey: (value: boolean) => void;
  setCapturedHotkey: (value: string) => void;
  onChange: (field: keyof CodeWindowButton, value: unknown) => void;
  onInsertPlaceholder: (placeholder: string) => void;
}
