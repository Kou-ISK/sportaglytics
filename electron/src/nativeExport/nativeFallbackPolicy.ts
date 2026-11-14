/** The existing provider reports a reason but provides no resource reservation or
 * verified cleanup receipt. Neither a successful probe nor a free-space snapshot
 * is a budget. Unknown reasons are treated as potentially post-creation. */
export type FallbackStage = 'not-started' | 'candidate-state-unknown';
export type FallbackDecision = { action: 'allow' | 'stop'; stage: FallbackStage; budget: 'checked' | 'unknown' };
const beforeCandidate = new Set(['platform', 'unsupported-request', 'non-local-source', 'source-unavailable', 'unsupported-source-type', 'native-busy', 'native-unavailable', 'native-pre-output-unsupported']);
export const evaluateNativeFallback = (reason: string, budgetChecked = false): FallbackDecision => ({
  action: beforeCandidate.has(reason) && budgetChecked ? 'allow' : 'stop',
  stage: beforeCandidate.has(reason) ? 'not-started' : 'candidate-state-unknown',
  budget: budgetChecked ? 'checked' : 'unknown',
});
export class NativeFallbackBudgetUnavailable extends Error {
  readonly decision: FallbackDecision;
  constructor(decision: FallbackDecision) {
    super('代替書き出しの資源予算を確認できないため停止しました');
    this.name = 'NativeFallbackBudgetUnavailable';
    this.decision = decision;
  }
}
