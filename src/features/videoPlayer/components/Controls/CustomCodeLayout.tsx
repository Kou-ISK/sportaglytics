import React from 'react';
import { Box } from '@mui/material';
import type {
  CodeWindowLayout,
  CodeWindowButton,
} from '../../../../types/settings/coreTypes';
import type { SCLabel } from '../../../../types/timeline/sportscode';
import {
  replaceTeamPlaceholderAliases,
  type TeamContext,
} from '../../../../utils/teamPlaceholder';
import { CodeWindowButtonSurface } from '../../../../components/ui/composites/CodeWindowButtonSurface';

type CustomCodeLayoutProps = {
  layout: CodeWindowLayout;
  teamContext: TeamContext;
  activeRecordings: Record<string, { startTime: number }>; // shape used only for existence
  primaryAction: string | null;
  activeLabelButtons: Record<string, boolean>;
  isRecording: boolean;
  selectedTimelineLabels: SCLabel[];
  layoutContainerRef: React.RefObject<HTMLDivElement | null>;
  onButtonClick: (button: CodeWindowButton) => void;
};

const hasSelectedTimelineLabel = (
  labels: SCLabel[],
  groupNames: string[],
  labelValue?: string,
): boolean => {
  if (!labelValue) return false;
  return labels.some(
    (label) =>
      label.name === labelValue &&
      groupNames.some((groupName) => label.group === groupName),
  );
};

export const CustomCodeLayout = ({
  layout,
  teamContext,
  activeRecordings,
  primaryAction,
  activeLabelButtons,
  isRecording,
  selectedTimelineLabels,
  layoutContainerRef,
  onButtonClick,
}: CustomCodeLayoutProps) => {
  return (
    <Box
      ref={layoutContainerRef}
      sx={{
        mb: 2,
        position: 'relative',
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        flex: '0 0 auto',
        backgroundColor: 'transparent',
        borderRadius: 0,
        border: 'none',
      }}
    >
      {layout.buttons.map((button) => {
        const resolvedButtonName = replaceTeamPlaceholderAliases(
          button.name,
          teamContext,
        );
        const isActive =
          button.type === 'action' &&
          Boolean(activeRecordings[resolvedButtonName]);
        const isSelected = isActive || primaryAction === resolvedButtonName;
        const isLabelSelected =
          button.type === 'label' &&
          (activeLabelButtons[button.id] ||
            hasSelectedTimelineLabel(
              selectedTimelineLabels,
              [resolvedButtonName, button.name],
              button.labelValue,
            ));

        const buttonColor =
          button.color || (button.type === 'action' ? '#1976d2' : '#9c27b0');
        const displayText =
          button.type === 'label' && button.labelValue
            ? button.labelValue
            : resolvedButtonName;
        return (
          <CodeWindowButtonSurface
            key={button.id}
            button={button}
            displayText={displayText}
            buttonColor={buttonColor}
            isActive={isSelected || isLabelSelected}
            isRecording={isRecording && isSelected}
            onClick={() => onButtonClick(button)}
          />
        );
      })}
    </Box>
  );
};
