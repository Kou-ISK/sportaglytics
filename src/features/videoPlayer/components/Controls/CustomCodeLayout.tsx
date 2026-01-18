import React from 'react';
import { Box } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { CodeWindowLayout, CodeWindowButton } from '../../../../types/Settings';
import {
  replaceTeamPlaceholders,
  type TeamContext,
} from '../../../../utils/teamPlaceholder';

type CustomCodeLayoutProps = {
  layout: CodeWindowLayout;
  teamContext: TeamContext;
  activeRecordings: Record<string, { startTime: number }>; // shape used only for existence
  primaryAction: string | null;
  activeLabelButtons: Record<string, boolean>;
  isRecording: boolean;
  layoutContainerRef: React.RefObject<HTMLDivElement>;
  layoutContainerWidth: number;
  onButtonClick: (button: CodeWindowButton) => void;
};

export const CustomCodeLayout = ({
  layout,
  teamContext,
  activeRecordings,
  primaryAction,
  activeLabelButtons,
  isRecording,
  layoutContainerRef,
  layoutContainerWidth,
  onButtonClick,
}: CustomCodeLayoutProps) => {
  const containerWidth = layoutContainerWidth || Math.max(1, layout.canvasWidth);
  const scale = containerWidth / layout.canvasWidth;
  const containerHeight = layout.canvasHeight * scale;

  return (
    <Box
      ref={layoutContainerRef}
      sx={{
        mb: 2,
        position: 'relative',
        width: '100%',
        height: containerHeight,
        backgroundColor: 'transparent',
        borderRadius: 0,
        border: 'none',
      }}
    >
      {layout.buttons.map((button) => {
        const resolvedButtonName = replaceTeamPlaceholders(
          button.name,
          teamContext,
        );
        const isActive =
          button.type === 'action' && Boolean(activeRecordings[resolvedButtonName]);
        const isSelected = isActive || primaryAction === resolvedButtonName;
        const isLabelSelected =
          button.type === 'label' && activeLabelButtons[button.id];

        const buttonColor =
          button.color || (button.type === 'action' ? '#1976d2' : '#9c27b0');
        const baseFontPx = button.fontSize ?? 14;
        const fontPx = Math.max(10, baseFontPx * scale);
        const displayText =
          button.type === 'label' && button.labelValue
            ? button.labelValue
            : resolvedButtonName;

        return (
          <Box
            key={button.id}
            onClick={() => onButtonClick(button)}
            sx={{
              position: 'absolute',
              left: button.x * scale,
              top: button.y * scale,
              width: button.width * scale,
              height: button.height * scale,
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
              borderRadius: `${(button.borderRadius ?? 4) * scale}px`,
              cursor: 'pointer',
              transition: 'all 0.15s',
              overflow: 'hidden',
              '&:hover': {
                backgroundColor:
                  isSelected || isLabelSelected ? buttonColor : `${buttonColor}22`,
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
              }}
            >
              {displayText}
            </span>
          </Box>
        );
      })}
    </Box>
  );
};
