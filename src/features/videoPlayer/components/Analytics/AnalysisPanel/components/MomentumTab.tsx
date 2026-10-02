import React, { useMemo, useState } from 'react';
import { MomentumChart } from '../../MomentumChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import type { CreateMomentumDataFn } from '../../../../../../types/analysis/momentum';
import { AnalysisCard } from './AnalysisCard';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { DrilldownDialog } from './DrilldownDialog';

interface MomentumTabProps {
  disableAnimation?: boolean;
  hasData: boolean;
  createMomentumData: CreateMomentumDataFn;
  teamNames: string[];
  timeline: TimelineData[];
  emptyMessage: string;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const MomentumTab = ({
  disableAnimation = false,
  hasData,
  createMomentumData,
  teamNames,
  timeline,
  emptyMessage,
  onJumpToSegment,
}: MomentumTabProps): React.JSX.Element => {
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);

  const timelineMap = useMemo(
    () => new Map(timeline.map((item) => [item.id, item])),
    [timeline],
  );

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  if (timeline.length === 0) {
    return <NoDataPlaceholder message="表示できるタイムラインがありません。" />;
  }

  return (
    <>
      <AnalysisCard title="モメンタムチャート">
        <MomentumChart
          disableAnimation={disableAnimation}
          createMomentumData={createMomentumData}
          teamNames={teamNames}
          onPointSelect={({ title, entryIds }) => {
            const entries = entryIds
              .map((id) => timelineMap.get(id))
              .filter(Boolean) as TimelineData[];
            setDetail({ title, entries });
          }}
        />
      </AnalysisCard>
      <DrilldownDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onJump={(segment) => onJumpToSegment?.(segment)}
      />
    </>
  );
};
