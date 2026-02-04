import React from 'react';
import { MomentumChart } from '../../MomentumChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';
import { AnalysisCard } from './AnalysisCard';

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
    <AnalysisCard title="モメンタムチャート">
      <MomentumChart
        createMomentumData={createMomentumData}
        teamNames={teamNames}
      />
    </AnalysisCard>
  );
};
