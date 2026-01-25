import React from 'react';
import { Divider } from '@mui/material';
import { MomentumChart } from '../../MomentumChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';
import { StatsCard } from './StatsCard';

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
    <StatsCard title="モメンタムチャート">
      <Divider sx={{ mb: 2 }} />
      <MomentumChart
        createMomentumData={createMomentumData}
        teamNames={teamNames}
      />
    </StatsCard>
  );
};
