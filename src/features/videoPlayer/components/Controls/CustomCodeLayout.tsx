import React from 'react';
import { Box } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type {
  CodeWindowLayout,
  CodeWindowButton,
} from '../../../../types/settings/coreTypes';
import type { SCLabel } from '../../../../types/timeline/sportscode';
import {
  replaceTeamPlaceholderAliases,
  type TeamContext,
} from '../../../../utils/teamPlaceholder';

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
        const fontPx = button.fontSize ?? 14;
        const displayText =
          button.type === 'label' && button.labelValue
            ? button.labelValue
            : resolvedButtonName;
        const showHotkey = Boolean(button.hotkey && button.showHotkey);

        return (
          <Box
            key={button.id}
            onClick={() => onButtonClick(button)}
            sx={{
              position: 'absolute',
              left: button.x,
              top: button.y,
              width: button.width,
              height: button.height,
              minWidth: 0,
              px: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                button.textAlign === 'left'
                  ? 'flex-start'
                  : button.textAlign === 'right'
                    ? 'flex-end'
                    : 'center',
              fontSize: `${fontPx}px`,
              fontWeight: 500,
              backgroundColor:
                isSelected || isLabelSelected ? buttonColor : 'transparent',
              color:
                isSelected || isLabelSelected
                  ? button.textColor || '#fff'
                  : buttonColor,
              border: `1px solid ${buttonColor}`,
              borderRadius: `${button.borderRadius ?? 4}px`,
              cursor: 'pointer',
              transition: 'all 0.15s',
              overflow: 'hidden',
              '&:hover': {
                backgroundColor:
                  isSelected || isLabelSelected
                    ? buttonColor
                    : `${buttonColor}22`,
              },
              '&:active': {
                transform: 'scale(0.98)',
              },
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          >
            {isRecording && isSelected && (
              <FiberManualRecordIcon
                sx={{
                  fontSize: '0.75rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  color: 'error.main',
                  mr: 0.25,
                }}
              />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: showHotkey ? 4 : 0,
              }}
            >
              {displayText}
            </span>
            {showHotkey && (
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  right: 4,
                  bottom: 2,
                  maxWidth: 'calc(100% - 8px)',
                  px: 0.5,
                  borderRadius: '3px',
                  fontSize: Math.max(8, Math.round(fontPx * 0.62)),
                  lineHeight: 1.15,
                  backgroundColor: 'rgba(0,0,0,0.16)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {button.hotkey}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
