import React, { forwardRef, useImperativeHandle } from 'react';
import {
  type EnhancedCodePanelHandle,
  type EnhancedCodePanelProps,
} from './EnhancedCodePanel.types';
import { EnhancedCodePanelView } from './EnhancedCodePanelView';
import { useEnhancedCodePanelController } from './hooks/useEnhancedCodePanelController';

export { type EnhancedCodePanelHandle };

export const EnhancedCodePanel = forwardRef<
  EnhancedCodePanelHandle,
  EnhancedCodePanelProps
>((props, ref) => {
  const { triggerAction, viewProps } = useEnhancedCodePanelController(props);

  useImperativeHandle(
    ref,
    () => ({
      triggerAction,
    }),
    [triggerAction],
  );

  return <EnhancedCodePanelView {...viewProps} />;
});

EnhancedCodePanel.displayName = 'EnhancedCodePanel';
