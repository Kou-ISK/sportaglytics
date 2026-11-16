import { expect, it } from 'vitest';
import { resolveExportVideoSize } from './exportVideoGeometry';
it('uses coded pixels after autorotation for single output', () => {
  expect(
    resolveExportVideoSize([{ width: 1920, height: 1080, rotation: -90 }]),
  ).toEqual({ width: 1080, height: 1920 });
});
it('matches SAR-normalized dual widths at the even primary height', () => {
  expect(
    resolveExportVideoSize([
      { width: 720, height: 576, sampleAspectRatio: 16 / 15 },
      { width: 1920, height: 1080 },
    ]),
  ).toEqual({ width: 1792, height: 576 });
  expect(
    resolveExportVideoSize([
      { width: 1920, height: 1080, rotation: 90 },
      { width: 1280, height: 720 },
    ]),
  ).toEqual({ width: 4492, height: 1920 });
});
