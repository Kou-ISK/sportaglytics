import React from 'react';
import Grid from '@mui/material/GridLegacy';
import type { ActionDefinition } from '../../../../types/Settings';
import { TeamActionSection } from './TeamActionSection';

type DefaultCodeLayoutProps = {
  teamNames: string[];
  referenceTeamName: string | undefined;
  actions: ActionDefinition[];
  primaryAction: string | null;
  activeRecordings: Record<string, { startTime: number }>;
  getActionLabels: (action: ActionDefinition) => { groupName: string; options: string[] }[];
  onActionClick: (teamName: string, action: ActionDefinition) => void;
  renderLabelGroup: (
    actionName: string,
    groupName: string,
    options: string[],
    isLastGroup: boolean,
  ) => React.ReactNode;
};

export const DefaultCodeLayout = ({
  teamNames,
  referenceTeamName,
  actions,
  primaryAction,
  activeRecordings,
  getActionLabels,
  onActionClick,
  renderLabelGroup,
}: DefaultCodeLayoutProps) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        {teamNames[0] && (
          <TeamActionSection
            teamName={teamNames[0]}
            isFirstTeam={teamNames[0] === referenceTeamName}
            actions={actions}
            primaryAction={primaryAction}
            activeRecordings={activeRecordings}
            getActionLabels={getActionLabels}
            onActionClick={onActionClick}
            renderLabelGroup={renderLabelGroup}
          />
        )}
      </Grid>
      <Grid item xs={6}>
        {teamNames[1] && (
          <TeamActionSection
            teamName={teamNames[1]}
            isFirstTeam={teamNames[1] === referenceTeamName}
            actions={actions}
            primaryAction={primaryAction}
            activeRecordings={activeRecordings}
            getActionLabels={getActionLabels}
            onActionClick={onActionClick}
            renderLabelGroup={renderLabelGroup}
          />
        )}
      </Grid>
    </Grid>
  );
};
