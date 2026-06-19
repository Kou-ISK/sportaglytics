import { forwardRef, useImperativeHandle } from 'react';
import type {
  EnhancedCodePanelHandle,
  EnhancedCodePanelProps,
} from './EnhancedCodePanel.types';
import { useEnhancedCodePanelController } from './hooks/useEnhancedCodePanelController';

export const CodingPanelRuntime = forwardRef<
  EnhancedCodePanelHandle,
  EnhancedCodePanelProps
>((props, ref) => {
  const { triggerAction } = useEnhancedCodePanelController(props);

  useImperativeHandle(
    ref,
    () => ({
      triggerAction,
    }),
    [triggerAction],
  );

  return null;
});

CodingPanelRuntime.displayName = 'CodingPanelRuntime';
