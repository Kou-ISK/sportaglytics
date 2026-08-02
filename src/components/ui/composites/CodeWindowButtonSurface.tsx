import React from 'react';
import { Box } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { CodeWindowButton } from '../../../types/settings/coreTypes';

interface CodeWindowButtonSurfaceProps {
  button: CodeWindowButton;
  displayText: string;
  buttonColor: string;
  isActive?: boolean;
  isRecording?: boolean;
  isSelectedForEditing?: boolean;
  isDragging?: boolean;
  cursor?: React.CSSProperties['cursor'];
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export const CodeWindowButtonSurface = ({
  button,
  displayText,
  buttonColor,
  isActive = false,
  isRecording = false,
  isSelectedForEditing = false,
  isDragging = false,
  cursor = 'pointer',
  onMouseDown,
  onDoubleClick,
  onContextMenu,
  onClick,
  children,
}: CodeWindowButtonSurfaceProps): React.ReactElement => {
  const fontSize = button.fontSize ?? 14;
  const showHotkey = Boolean(button.hotkey && button.showHotkey);

  return (
    <Box
      data-code-window-button={button.id}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onClick={onClick}
      sx={{
        position: 'absolute',
        left: button.x,
        top: button.y,
        width: button.width,
        height: button.height,
        minWidth: 0,
        px: 0.5,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          button.textAlign === 'left'
            ? 'flex-start'
            : button.textAlign === 'right'
              ? 'flex-end'
              : 'center',
        fontSize: `${fontSize}px`,
        fontWeight: 500,
        backgroundColor: isActive ? buttonColor : 'transparent',
        color: isActive ? button.textColor || '#fff' : buttonColor,
        border: `1px solid ${buttonColor}`,
        borderRadius: `${button.borderRadius ?? 4}px`,
        cursor,
        transition: isDragging
          ? 'none'
          : 'background-color 0.15s, box-shadow 0.15s, transform 0.15s',
        overflow: 'hidden',
        userSelect: 'none',
        opacity: isDragging ? 0.8 : 1,
        zIndex: isSelectedForEditing ? 10 : 1,
        boxShadow: isSelectedForEditing
          ? '0 0 0 2px var(--mui-palette-primary-main, #1976d2)'
          : undefined,
        outline: isSelectedForEditing ? '1px solid #fff' : undefined,
        outlineOffset: -2,
        '&:hover': {
          backgroundColor: isActive ? buttonColor : `${buttonColor}22`,
        },
        '&:active': {
          transform: isDragging ? undefined : 'scale(0.98)',
        },
        '@keyframes code-window-recording-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      }}
    >
      {isRecording && isActive && (
        <FiberManualRecordIcon
          sx={{
            flex: '0 0 auto',
            fontSize: '0.75rem',
            animation: 'code-window-recording-pulse 1.5s ease-in-out infinite',
            color: 'error.main',
            mr: 0.25,
          }}
        />
      )}
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pr: showHotkey ? 0.5 : 0,
        }}
      >
        {displayText}
      </Box>
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
            fontSize: Math.max(8, Math.round(fontSize * 0.62)),
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
      {children}
    </Box>
  );
};
