import { expect, it } from 'vitest';
import { CacheConversionEvidence } from './cacheConversionEvidence';
it('retains stderr bytes without holding mutable worker buffers', () => {
  const evidence = new CacheConversionEvidence();
  const bytes = Buffer.from('one');
  evidence.observe(bytes);
  bytes.fill(0);
  evidence.observe(Buffer.from(' two'));
  expect(evidence.snapshot()).toEqual({ stderr: 'one two', truncated: false });
});
it('bounds retained diagnostics while making truncation explicit', () => {
  const evidence = new CacheConversionEvidence();
  evidence.observe(Buffer.alloc(300 * 1024, 'x'));
  evidence.observe(Buffer.from('late'));
  expect(evidence.snapshot().stderr).toHaveLength(256 * 1024);
  expect(evidence.snapshot().truncated).toBe(true);
});
