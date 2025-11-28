import React from 'react';
import { Grid, Paper, Stack, Typography, Divider } from '@mui/material';
import { ActionPieChart } from '../../ActionPieChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { useActionBreakdown } from './hooks/useActionBreakdown';
import { rechartsData } from '../../../../../../types/RechartsData';

interface ActionBreakdownTabProps {
  hasData: boolean;
  actions: ReadonlyArray<string>;
  teamNames: ReadonlyArray<string>;
  countActionFunction: (
    teamName: string,
    actionName: string,
  ) => rechartsData[];
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
        <Paper key={actionName} elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {titleFormatter(actionName)}
          </Typography>
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
        </Paper>
      ))}
    </Stack>
  );
};
