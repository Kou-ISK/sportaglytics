import React from 'react';
import { Divider, Paper, Typography } from '@mui/material';
import { MomentumChart } from '../../MomentumChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';

interface MomentumTabProps {
  hasData: boolean;
  createMomentumData: CreateMomentumDataFn;
  teamNames: string[];
  emptyMessage: string;
}

export const MomentumTab = ({
  hasData,
  createMomentumData,
  teamNames,
  emptyMessage,
}: MomentumTabProps) => {
  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        モメンタムチャート
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <MomentumChart
        createMomentumData={createMomentumData}
        teamNames={teamNames}
      />
    </Paper>
  );
};
