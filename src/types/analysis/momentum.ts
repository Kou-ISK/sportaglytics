export type MomentumOutcome = 'Try' | 'Positive' | 'Negative' | 'Neutral';

export interface MomentumSegment {
  entryId?: string;
  teamName: string;
  value: number;
  absoluteValue: number;
  possessionStart: string;
  possessionResult: string;
  outcome: MomentumOutcome;
}

export type CreateMomentumDataFn = (
  team1Name: string,
  team2Name: string,
) => MomentumSegment[];
