import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { ActionDefinition } from '../../../../types/Settings';

type LabelGroup = { groupName: string; options: string[] };

type TeamActionSectionProps = {
  teamName: string;
  isFirstTeam: boolean;
  actions: ActionDefinition[];
  primaryAction: string | null;
  activeRecordings: Record<string, { startTime: number }>;
  getActionLabels: (action: ActionDefinition) => LabelGroup[];
  onActionClick: (teamName: string, action: ActionDefinition) => void;
  renderLabelGroup: (
    actionName: string,
    groupName: string,
    options: string[],
    isLastGroup: boolean,
  ) => React.ReactNode;
};

export const TeamActionSection = ({
  teamName,
  isFirstTeam,
  actions,
  primaryAction,
  activeRecordings,
  getActionLabels,
  onActionClick,
  renderLabelGroup,
}: TeamActionSectionProps) => {
  const color = isFirstTeam ? 'team1' : 'team2';

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1,
          fontWeight: 'bold',
          color: `${color}.main`,
        }}
      >
        {teamName}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {actions.map((action) => {
          const isActive = Boolean(activeRecordings[action.action]);
          const isSelected = isActive || primaryAction === action.action;
          const labelGroups = getActionLabels(action);
          const hasLabels = labelGroups.length > 0;
          return (
            <Box key={action.action}>
              <Button
                variant={isSelected ? 'contained' : 'outlined'}
                color={color}
                onClick={() => onActionClick(teamName, action)}
                startIcon={
                  isActive ? (
                    <FiberManualRecordIcon
                      sx={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                    />
                  ) : undefined
                }
                sx={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minHeight: 36,
                  fontSize: '0.8rem',
                  px: 1.5,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              >
                {action.action}
              </Button>

              {isSelected && hasLabels && (
                <Box
                  sx={{
                    mt: 0.5,
                    ml: 1,
                    p: 1,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    borderLeft: 3,
                    borderColor: `${color}.main`,
                  }}
                >
                  {labelGroups.map((group, groupIndex) =>
                    renderLabelGroup(
                      action.action,
                      group.groupName,
                      group.options,
                      groupIndex === labelGroups.length - 1,
                    ),
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
