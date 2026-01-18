import React from 'react';
import Grid from '@mui/material/GridLegacy';
import { Stack, Divider } from '@mui/material';
import { ActionPieChart } from '../../ActionPieChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { useActionBreakdown } from './hooks/useActionBreakdown';
import { rechartsData } from '../../../../../../types/RechartsData';
import { StatsCard } from './StatsCard';

interface ActionBreakdownTabProps {
  hasData: boolean;
  actions: ReadonlyArray<string>;
  teamNames: ReadonlyArray<string>;
  countActionFunction: (teamName: string, actionName: string) => rechartsData[];
  titleFormatter: (actionName: string) => string;
  emptyMessage: string;
}

export const ActionBreakdownTab = ({
  hasData,
  actions,
  teamNames,
  countActionFunction,
  titleFormatter,
  emptyMessage,
}: ActionBreakdownTabProps) => {
  const breakdown = useActionBreakdown({
    hasData,
    actions,
    teamNames,
    countActionFunction,
  });

  if (!hasData || actions.length === 0 || breakdown.length === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <Stack spacing={3}>
      {breakdown.map(({ actionName, teams }) => (
        <StatsCard key={actionName} title={titleFormatter(actionName)}>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {teams.map(({ team }) => (
              <Grid item xs={12} md={6} key={team}>
                <ActionPieChart
                  countActionFunction={countActionFunction}
                  teamName={team}
                  actionName={actionName}
                />
              </Grid>
            ))}
          </Grid>
        </StatsCard>
      ))}
    </Stack>
  );
};
