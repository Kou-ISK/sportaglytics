import { expect, it } from 'vitest';
import {
  createExportNameAllocator,
  portableExportStem,
} from './exportFileNames';

it('keeps export names valid across Windows and macOS', () => {
  expect(portableExportStem('Attack: 1/2?')).toBe('Attack__1_2_');
  expect(portableExportStem('CON')).toBe('_CON');
  expect(portableExportStem('..')).toBe('export');
  expect(portableExportStem('得点 #50%')).toBe('得点_#50%');
  expect(
    Buffer.byteLength(portableExportStem('日本語'.repeat(100)), 'utf8'),
  ).toBeLessThanOrEqual(100);
});
it('preserves different rows whose sanitized or case-folded names collide', () => {
  const allocate = createExportNameAllocator();
  expect(allocate('Attack_1.mp4')).toBe('Attack_1.mp4');
  expect(allocate('attack_1.mp4')).toBe('attack_1_2.mp4');
  expect(allocate('attack_1.mp4')).toBe('attack_1_3.mp4');
});
