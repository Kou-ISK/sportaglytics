import assert from 'node:assert/strict';

// Diagnostic source-sample changes only, not physical display or pixel hashes.
// A new global anchor/pair ID inside the same source intervals is not a new image.
export function reverseSourceImageProgress(
  pairs,
  baseline,
  startedAt,
  stoppedAt,
) {
  const validPTS = (value) =>
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (pts) => typeof pts === 'number' && Number.isFinite(pts) && pts >= 0,
    );
  assert.ok(validPTS(baseline));
  assert.ok(
    Number.isFinite(startedAt) &&
      Number.isFinite(stoppedAt) &&
      stoppedAt >= startedAt,
  );
  let previous = baseline;
  let previousTime = startedAt;
  const changes = [];
  const angleChanges = [[], []];
  for (const pair of pairs) {
    assert.ok(
      Number.isFinite(pair.ms) &&
        pair.ms >= previousTime &&
        pair.ms <= stoppedAt,
    );
    assert.ok(validPTS(pair.sourcePTS));
    assert.ok(
      pair.sourcePTS.every((pts, index) => pts <= previous[index]),
      'reverse source image must not advance',
    );
    if (pair.sourcePTS.some((pts, index) => pts < previous[index]))
      changes.push(pair.ms);
    pair.sourcePTS.forEach((pts, angle) => {
      if (pts < previous[angle]) angleChanges[angle].push(pair.ms);
    });
    previous = pair.sourcePTS;
    previousTime = pair.ms;
  }
  const times = [startedAt, ...changes, stoppedAt];
  return {
    changedImagePairs: changes.length,
    angleImageChanges: angleChanges.map((times) => times.length),
    firstAngleImageChangeMs: angleChanges.map((times) =>
      times.length ? times[0] - startedAt : null,
    ),
    maximumAngleImageSilenceMs: angleChanges.map((changes) => {
      const times = [startedAt, ...changes, stoppedAt];
      return Math.max(
        ...times.slice(1).map((time, index) => time - times[index]),
      );
    }),
    trailingAngleImageSilenceMs: angleChanges.map(
      (times) => stoppedAt - (times.at(-1) ?? startedAt),
    ),
    firstSourceImageChangeMs: changes.length ? changes[0] - startedAt : null,
    maximumSourceImageSilenceMs: Math.max(
      ...times.slice(1).map((time, index) => time - times[index]),
    ),
    trailingSourceImageSilenceMs: stoppedAt - (changes.at(-1) ?? startedAt),
  };
}
