import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface ControlButtonProps {
  title: string;
  icon: React.ReactNode;
  actionKey: string;
  disabled: boolean;
  flashing: boolean;
  active?: boolean;
  emphasize?: boolean;
  onClick: () => void;
  onTriggerFlash: (key: string) => void;
}

export const ControlButton: React.FC<ControlButtonProps> = ({
  title,
  icon,
  actionKey,
  disabled,
  flashing,
  active,
  emphasize,
  onClick,
  onTriggerFlash,
}) => {
  const theme = useTheme();
  const isActive = !!active || flashing;

  // 背景色の決定
  const getBgColor = () => {
    if (isActive) {
      return emphasize ? 'primary.main' : theme.custom.glass.hoverStrong;
    }
    return theme.custom.glass.hover;
  };

  const getHoverBgColor = () => {
    if (isActive) {
      return emphasize ? 'primary.dark' : theme.custom.accents.hoverPink;
    }
    return theme.custom.glass.hoverStrong;
  };

  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          aria-label={title}
          onClick={() => {
            if (disabled) return;
            onClick();
            onTriggerFlash(actionKey);
          }}
          disabled={disabled}
          sx={{
            ...theme.custom.controllerButton,
            bgcolor: getBgColor(),
            '&:hover': {
              bgcolor: getHoverBgColor(),
            },
            boxShadow: flashing
              ? `0 0 0 2px ${theme.custom.bars.selectedBorder}`
              : undefined,
          }}
          size="large"
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};
