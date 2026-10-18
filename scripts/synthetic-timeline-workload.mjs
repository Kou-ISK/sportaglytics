/** Deterministic synthetic metadata only; not a recording or model ground truth. */
export const createSyntheticTimeline = ({
  count,
  rows = 24,
  duration = 5400,
}) => {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100000 ||
    !Number.isInteger(rows) ||
    rows < 1 ||
    rows > 1000 ||
    !Number.isFinite(duration) ||
    duration < 10 ||
    duration > 86400
  )
    throw new RangeError(
      'Expected count 1..100000, rows 1..1000, duration 10..86400 seconds',
    );
  const definitions = Array.from({ length: rows }, (_, index) => ({
    id: `synthetic-row-${index}`,
    name: `Synthetic ${index % 2 ? 'Blue' : 'Orange'} / Action ${index}`,
    color: index % 2 ? '#2277aa' : '#bb5533',
  }));
  return {
    version: 2,
    rows: definitions,
    instances: Array.from({ length: count }, (_, index) => {
      const row = definitions[index % rows];
      // A coprime permutation prevents the search's sort from seeing pre-sorted input.
      const startTime = (((index * 7919) % count) / count) * (duration - 5);
      return {
        id: `synthetic-event-${index}`,
        actionName: row.name,
        startTime,
        endTime: startTime + 3,
        color: row.color,
        memo: `合成の検証メモ ${index} ${index % 17 === 0 ? 'needle' : 'routine'}`,
        labels: [{ group: '結果', name: index % 2 ? '成功' : '継続' }],
      };
    }),
  };
};

export const summarizeTimings = (values) => {
  if (
    !values.length ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new RangeError('Expected non-negative finite timings');
  const ordered = [...values].sort((left, right) => left - right);
  const percentile = (fraction) =>
    ordered[Math.ceil(ordered.length * fraction) - 1];
  const rounded = (value) => Math.round(value * 1000) / 1000;
  return {
    count: values.length,
    minMs: rounded(ordered[0]),
    p50Ms: rounded(percentile(0.5)),
    p95Ms: rounded(percentile(0.95)),
    maxMs: rounded(ordered.at(-1)),
  };
};
