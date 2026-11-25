// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { entersColdSecondAngle } from './videoPresentationTargets';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: (id: string) => ({ el: () => document.getElementById(id) }),
}));
it('only masks a cold second angle crossing an actual clip gap including its sync offset', () => {
  document.body.innerHTML = '<div id="video_0"><video></video></div>';
  const ready = (index: number, src: string) => {
    const v = document.querySelector('#video_' + index + ' video')!;
    Object.defineProperties(v, {
      currentSrc: { value: 'file:///' + src, configurable: true },
      readyState: { value: 4, configurable: true },
    });
  };
  const sources = ['a.mp4', 'c.mp4'];
  const angles = sources.map((source, i) => ({
    id: source,
    name: source,
    sourceKind: 'local' as const,
    clips: [
      {
        id: source,
        source,
        sourceKind: 'local' as const,
        timelineStartSeconds: i * 4,
        gapBeforeSeconds: i * 4,
        durationSeconds: 40,
      },
    ],
  }));
  const sync = { syncOffset: 1, isAnalyzed: true };
  const eligible = (before: number, target: number) =>
    entersColdSecondAngle(before, target, sources, angles, sync);
  expect(eligible(0, 5)).toBe(false); // primary is not ready
  ready(0, 'a.mp4');
  expect(eligible(0, 2)).toBe(false); // C intentionally remains empty
  expect(eligible(0, 3.5)).toBe(true); // C local 0.5, reflecting offset
  expect(eligible(4, 5)).toBe(false); // no gap crossing
  expect(
    entersColdSecondAngle(0, 5, sources.slice(0, 1), angles.slice(0, 1), sync),
  ).toBe(false);
  const multi = angles.map((a) => ({ ...a, clips: [...a.clips, ...a.clips] }));
  expect(entersColdSecondAngle(0, 5, sources, multi, sync)).toBe(false);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="video_1"><video></video></div>',
  );
  ready(1, 'previous.mp4');
  expect(eligible(0, 5)).toBe(true);
  ready(1, 'c.mp4');
  expect(eligible(0, 5)).toBe(false);
});
