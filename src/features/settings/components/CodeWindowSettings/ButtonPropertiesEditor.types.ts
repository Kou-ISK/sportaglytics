import type React from 'react';
import type { CodeWindowButton } from '../../../../types/settings/coreTypes';
import type { LabelGroup } from './ButtonBasicTab.types';

export interface ButtonPropertiesEditorProps {
  button: CodeWindowButton | null;
  onUpdate: (button: CodeWindowButton) => void;
  onDelete: () => void;
  availableActions: string[];
  availableLabelGroups: LabelGroup[];
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ButtonPropertiesEditorViewProps extends ButtonPropertiesEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  localColor: string;
  tabIndex: number;
  currentLabelGroup?: LabelGroup;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  capturedHotkey: string;
  isCapturingHotkey: boolean;
  onTabChange: (value: number) => void;
  setLocalColor: (value: string) => void;
  setIsCapturingHotkey: (value: boolean) => void;
  setCapturedHotkey: (value: string) => void;
  onChange: (field: keyof CodeWindowButton, value: unknown) => void;
  onInsertPlaceholder: (placeholder: string) => void;
  onColorChange: (color: string) => void;
  onNumberChange: (
    field: keyof CodeWindowButton,
    value: string,
    min: number,
    max: number,
  ) => void;
}
