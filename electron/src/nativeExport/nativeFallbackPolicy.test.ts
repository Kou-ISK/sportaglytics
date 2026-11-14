import { expect, it } from 'vitest';
import { evaluateNativeFallback } from './nativeFallbackPolicy';
it.each(['platform', 'unsupported-request', 'non-local-source', 'source-unavailable', 'unsupported-source-type', 'native-busy', 'native-unavailable'])('does not claim a budget for pre-creation reason %s', (reason) => {
  expect(evaluateNativeFallback(reason)).toEqual({ action: 'stop', stage: 'not-started', budget: 'unknown' });
});
it.each(['native-unqualified', 'output-unqualified', 'output-storage-incompatible', 'unexpected'])('treats %s as candidate state unknown without a budget', (reason) => {
  expect(evaluateNativeFallback(reason)).toEqual({ action: 'stop', stage: 'candidate-state-unknown', budget: 'unknown' });
});
it('allows only a pre-creation fallback after resource checks', () => {
  expect(evaluateNativeFallback('native-unavailable', true)).toEqual({ action: 'allow', stage: 'not-started', budget: 'checked' });
  expect(evaluateNativeFallback('native-busy', true).action).toBe('allow');
  expect(evaluateNativeFallback('output-unqualified', true).action).toBe('stop');
});

it('permits a pre-output unsupported result only after budget checking', () => {
  expect(evaluateNativeFallback('native-pre-output-unsupported').action).toBe('stop');
  expect(evaluateNativeFallback('native-pre-output-unsupported', true)).toEqual({ action: 'allow', stage: 'not-started', budget: 'checked' });
  expect(evaluateNativeFallback('native-range-not-covered', true).action).toBe('stop');
});
