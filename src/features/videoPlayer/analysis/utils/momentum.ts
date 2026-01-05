import { TimelineData } from '../../../../types/TimelineData';
import {
  CreateMomentumDataFn,
  MomentumOutcome,
  MomentumSegment,
} from '../../../../types/Analysis';
import { getLabelByGroupWithFallback } from '../../../../utils/labelExtractors';

const POSSESSION_KEYWORD = 'ポゼッション';

const NEGATIVE_RESULTS = new Set([
  'Kick Error',
  'Pen Con',
  'Turnover',
  'Turnover (Scrum)',
]);

const POSITIVE_RESULTS = new Set([
  'Try',
  'Drop Goal',
  'Pen Won',
  'Scrum',
  'Own Lineout',
]);

const resolveOutcome = (result?: string | null): MomentumOutcome => {
  if (result === 'Try') {
    return 'Try';
  }
  if (result && NEGATIVE_RESULTS.has(result)) {
    return 'Negative';
  }
  if (result && POSITIVE_RESULTS.has(result)) {
    return 'Positive';
  }
  return 'Neutral';
};

const resolveTeamName = (actionName: string, team1: string, team2: string) => {
  if (actionName.includes(team1)) return team1;
  if (actionName.includes(team2)) return team2;
  return team1;
};

const buildSegment = (
  entry: TimelineData,
  teamName: string,
  team1: string,
): MomentumSegment => {
  const duration = Math.max(0, entry.endTime - entry.startTime);
  const value = teamName === team1 ? -duration : duration;

  // SCTimeline形式のlabels配列から取得、なければ従来のフィールドから取得
  const actionType = getLabelByGroupWithFallback(
    entry,
    'actionType',
    entry.actionType || '開始情報なし',
  );
  const actionResult = getLabelByGroupWithFallback(
    entry,
    'actionResult',
    entry.actionResult || '結果なし',
  );

  return {
    teamName,
    value,
    absoluteValue: duration,
    possessionStart: actionType,
    possessionResult: actionResult,
    outcome: resolveOutcome(actionResult),
  };
};

export const createMomentumDataFactory = (
  timeline: TimelineData[],
): CreateMomentumDataFn => {
  return (team1Name, team2Name) => {
    const segments = timeline
      .filter((item) => item.actionName.includes(POSSESSION_KEYWORD))
      .map((item) => {
        const teamName = resolveTeamName(item.actionName, team1Name, team2Name);
        return buildSegment(item, teamName, team1Name);
      });
    return segments;
  };
};
