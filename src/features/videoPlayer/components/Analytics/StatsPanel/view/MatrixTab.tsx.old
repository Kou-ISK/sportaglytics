import React, { useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import { TimelineData } from '../../../../../../types/TimelineData';
import { MatrixSection } from './MatrixSection';
import { DrilldownDialog } from './DrilldownDialog';
import { NoDataPlaceholder } from './NoDataPlaceholder';

interface MatrixTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  uniqueActionTypes: string[];
  uniqueActionResults: string[];
  onJumpToSegment?: (segment: TimelineData) => void;
  emptyMessage: string;
}

type MatrixCell = { count: number; entries: TimelineData[] };

const buildMatrix = (
  entries: TimelineData[],
  rowKeys: string[],
  columnKeys: string[],
  rowAccessor: (item: TimelineData) => string,
  colAccessor: (item: TimelineData) => string,
): MatrixCell[][] => {
  if (rowKeys.length === 0 || columnKeys.length === 0) {
    return [];
  }

  const rowMap = new Map<string, number>();
  rowKeys.forEach((key, index) => rowMap.set(key, index));

  const colMap = new Map<string, number>();
  columnKeys.forEach((key, index) => colMap.set(key, index));

  const cells: MatrixCell[][] = rowKeys.map(() =>
    columnKeys.map(() => ({ count: 0, entries: [] })),
  );

  entries.forEach((item) => {
    const rowKey = rowAccessor(item);
    const colKey = colAccessor(item);
    const rowIndex = rowMap.get(rowKey);
    const colIndex = colMap.get(colKey);
    if (rowIndex === undefined || colIndex === undefined) {
      return;
    }
    const cell = cells[rowIndex]?.[colIndex];
    if (!cell) {
      return;
    }
    cell.count += 1;
    cell.entries.push(item);
  });

  return cells;
};

export const MatrixTab = ({
  hasData,
  timeline,
  teamNames,
  uniqueActionTypes,
  uniqueActionResults,
  onJumpToSegment,
  emptyMessage,
}: MatrixTabProps) => {
  const [detail, setDetail] = useState<{
    title: string;
    entries: TimelineData[];
  } | null>(null);

  const actionTypeVsResult = useMemo(
    () =>
      buildMatrix(
        timeline,
        uniqueActionTypes,
        uniqueActionResults,
        (item) => item.actionType || '未設定',
        (item) => item.actionResult || '未設定',
      ),
    [timeline, uniqueActionTypes, uniqueActionResults],
  );

  const actionsByTeam = useMemo(() => {
    const map = new Map<
      string,
      {
        actions: string[];
        byType: MatrixCell[][];
        byResult: MatrixCell[][];
      }
    >();

    teamNames.forEach((team) => {
      const entries = timeline.filter((item) =>
        item.actionName.startsWith(`${team} `),
      );
      const actionSet = new Set<string>();
      entries.forEach((item) => {
        const parts = item.actionName.split(' ');
        const baseAction = parts.slice(1).join(' ') || parts[0] || '未設定';
        actionSet.add(baseAction);
      });
      const actions = Array.from(actionSet).sort();

      const actionAccessor = (item: TimelineData) => {
        const parts = item.actionName.split(' ');
        return parts.slice(1).join(' ') || parts[0] || '未設定';
      };

      const byType = buildMatrix(
        entries,
        actions,
        uniqueActionTypes,
        actionAccessor,
        (item) => item.actionType || '未設定',
      );

      const byResult = buildMatrix(
        entries,
        actions,
        uniqueActionResults,
        actionAccessor,
        (item) => item.actionResult || '未設定',
      );

      map.set(team, { actions, byType, byResult });
    });

    return map;
  }, [teamNames, timeline, uniqueActionTypes, uniqueActionResults]);

  if (!hasData) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <>
      <Stack spacing={4}>
        <MatrixSection
          title="アクション種別 × アクション結果"
          rowKeys={uniqueActionTypes}
          columnKeys={uniqueActionResults}
          matrix={actionTypeVsResult}
          onDrilldown={(title, entries) => setDetail({ title, entries })}
        />
        {Array.from(actionsByTeam.entries()).map(([team, matrices]) => {
          if (matrices.actions.length === 0) {
            return null;
          }
          return (
            <Stack key={team} spacing={3}>
              <MatrixSection
                title={`${team} - アクション × アクション種別`}
                rowKeys={matrices.actions}
                columnKeys={uniqueActionTypes}
                matrix={matrices.byType}
                onDrilldown={(title, entries) => setDetail({ title, entries })}
              />
              <MatrixSection
                title={`${team} - アクション × アクション結果`}
                rowKeys={matrices.actions}
                columnKeys={uniqueActionResults}
                matrix={matrices.byResult}
                onDrilldown={(title, entries) => setDetail({ title, entries })}
              />
            </Stack>
          );
        })}
      </Stack>

      <DrilldownDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onJump={(segment) => {
          onJumpToSegment?.(segment);
          setDetail(null);
        }}
      />
    </>
  );
};
