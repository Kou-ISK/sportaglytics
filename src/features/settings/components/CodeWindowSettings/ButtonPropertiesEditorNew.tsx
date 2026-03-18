import React from 'react';
import { ButtonPropertiesEditorView } from './ButtonPropertiesEditorView';
import { useButtonPropertiesEditorController } from './hooks/useButtonPropertiesEditorController';
import type { ButtonPropertiesEditorProps } from './ButtonPropertiesEditor.types';

export const ButtonPropertiesEditor: React.FC<ButtonPropertiesEditorProps> = (
  props,
) => {
  const viewProps = useButtonPropertiesEditorController(props);
  return <ButtonPropertiesEditorView {...viewProps} />;
};
