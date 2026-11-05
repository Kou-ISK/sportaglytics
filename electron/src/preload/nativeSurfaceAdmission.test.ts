import { expect, it } from 'vitest';
import { createAdmission } from './nativeSurfaceAdmission';
const frame = (id: number, pts: number, sequence = 1) => ({
  document: 'document',
  generation: 'source',
  nativeGeneration: sequence,
  seekId: 1,
  id,
  pts,
});
it.each([-0.5, -2, -4, -6])(
  'admits decreasing source PTS at %s while preserving delivery and operation order',
  (rate) => {
    const admission = createAdmission();
    admission.expect('source', 1, 1, rate);
    expect(admission.commit(frame(1, 3000))).toBe(true);
    expect(admission.commit(frame(2, 2900))).toBe(true);
    expect(admission.current(frame(1, 2800))).toBe(false);
    expect(admission.current(frame(3, 3100))).toBe(false);
    expect(admission.current({ ...frame(3, 2800), document: 'old' })).toBe(
      false,
    );
    admission.expect('source', 1, 2, 1);
    expect(admission.current(frame(4, 2700))).toBe(false);
    expect(admission.commit(frame(5, 2800, 2))).toBe(true);
    expect(admission.commit(frame(6, 2900, 2))).toBe(true);
    admission.expect('replacement', 2, 3, -2);
    expect(admission.current(frame(7, 3000, 2))).toBe(false);
  },
);
