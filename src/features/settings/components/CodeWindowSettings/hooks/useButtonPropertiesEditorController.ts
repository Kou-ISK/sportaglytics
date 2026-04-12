import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CodeWindowButton } from '../../../../../types/Settings';
import type { ButtonPropertiesEditorProps } from '../ButtonPropertiesEditor.types';
import type { ButtonPropertiesEditorViewProps } from '../ButtonPropertiesEditor.types';

const formatKeyCombo = (event: KeyboardEvent): string => {
  const keys: string[] = [];

  if (event.metaKey) keys.push('Command');
  if (event.ctrlKey) keys.push('Control');
  if (event.altKey) keys.push('Option');
  if (event.shiftKey) keys.push('Shift');

  if (event.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    const keyName =
      event.key.length === 1 ? event.key.toUpperCase() : event.key;
    keys.push(keyName);
  }

  return keys.join('+');
};

export const useButtonPropertiesEditorController = ({
  button,
  onUpdate,
  onDelete,
  availableActions,
  availableLabelGroups,
  canvasWidth = 800,
  canvasHeight = 600,
}: ButtonPropertiesEditorProps): ButtonPropertiesEditorViewProps => {
  const [localColor, setLocalColor] = useState(button?.color || '');
  const [tabIndex, setTabIndex] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isCapturingHotkey, setIsCapturingHotkey] = useState(false);
  const [capturedHotkey, setCapturedHotkey] = useState('');

  useEffect(() => {
    setLocalColor(button?.color || '');
    setCapturedHotkey(button?.hotkey || '');
    setIsCapturingHotkey(false);
  }, [button?.id, button?.color, button?.hotkey]);

  useEffect(() => {
    if (!isCapturingHotkey) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setIsCapturingHotkey(false);
        setCapturedHotkey(button?.hotkey || '');
        return;
      }

      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
        return;
      }

      const keyCombo = formatKeyCombo(event);
      setCapturedHotkey(keyCombo);
      setIsCapturingHotkey(false);

      if (button) {
        onUpdate({ ...button, hotkey: keyCombo });
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [button, isCapturingHotkey, onUpdate]);

  const currentLabelGroup = useMemo(
    () =>
      availableLabelGroups.find((group) => group.groupName === button?.name),
    [availableLabelGroups, button?.name],
  );

  const handleChange = useCallback(
    (field: keyof CodeWindowButton, value: unknown): void => {
      if (!button) {
        return;
      }

      onUpdate({ ...button, [field]: value });
    },
    [button, onUpdate],
  );

  const handleColorChange = useCallback(
    (color: string): void => {
      setLocalColor(color);
      if (button) {
        onUpdate({ ...button, color });
      }
    },
    [button, onUpdate],
  );

  const handleInsertPlaceholder = useCallback(
    (placeholder: string): void => {
      if (!button) {
        return;
      }

      const input = nameInputRef.current;
      if (!input) {
        onUpdate({ ...button, name: button.name + placeholder });
        return;
      }

      const start = input.selectionStart ?? button.name.length;
      const end = input.selectionEnd ?? button.name.length;
      const newValue =
        button.name.slice(0, start) + placeholder + button.name.slice(end);
      onUpdate({ ...button, name: newValue });

      globalThis.setTimeout(() => {
        input.focus();
        const nextPosition = start + placeholder.length;
        input.setSelectionRange(nextPosition, nextPosition);
      }, 0);
    },
    [button, onUpdate],
  );

  const handleNumberChange = useCallback(
    (
      field: keyof CodeWindowButton,
      value: string,
      min: number,
      max: number,
    ): void => {
      if (!button) {
        return;
      }

      const nextValue = parseInt(value, 10);
      if (!Number.isNaN(nextValue)) {
        onUpdate({
          ...button,
          [field]: Math.max(min, Math.min(max, nextValue)),
        });
      }
    },
    [button, onUpdate],
  );

  return {
    button,
    onUpdate,
    onDelete,
    availableActions,
    availableLabelGroups,
    canvasWidth,
    canvasHeight,
    localColor,
    tabIndex,
    currentLabelGroup,
    nameInputRef,
    capturedHotkey,
    isCapturingHotkey,
    onTabChange: setTabIndex,
    setLocalColor,
    setIsCapturingHotkey,
    setCapturedHotkey,
    onChange: handleChange,
    onInsertPlaceholder: handleInsertPlaceholder,
    onColorChange: handleColorChange,
    onNumberChange: handleNumberChange,
  };
};
