import React, { useMemo, useState } from 'react';
import { MomentumChart } from '../../MomentumChart';
import { NoDataPlaceholder } from './NoDataPlaceholder';
import { CreateMomentumDataFn } from '../../../../../../types/Analysis';
import { AnalysisCard } from './AnalysisCard';
import type { TimelineData } from '../../../../../../types/TimelineData';
import { DrilldownDialog } from './DrilldownDialog';

interface MomentumTabProps {
  hasData: boolean;
  createMomentumData: CreateMomentumDataFn;
  teamNames: string[];
  timeline: TimelineData[];
  emptyMessage: string;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const MomentumTab = ({
  hasData,
  createMomentumData,
  teamNames,
  timeline,
  emptyMessage,
  onJumpToSegment,
}: MomentumTabProps) => {
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
    return (
      <NoDataPlaceholder
        message="表示できるタイムラインがありません。"
      />
    );
  }

  return (
    <>
      <AnalysisCard title="モメンタムチャート">
        <MomentumChart
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
