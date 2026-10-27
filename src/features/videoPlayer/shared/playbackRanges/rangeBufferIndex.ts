/** Transport coverage is in original media seconds. Construction belongs to
 * the verified artifact adapter; it is not derived from filename/duration. */
export interface PlaybackRangeFragment {
  id: number;
  bytes: number;
  videoStart: number;
  videoEnd: number;
  sampleStart: number;
  sampleEnd: number;
  /** Includes the RAP and whole AAC packets needed at this video's start. */
  dependencies: readonly number[];
}
export interface PlaybackRangeIndex {
  sourceGeneration: string;
  initializationBytes: number;
  presentationEnd: number;
  fragments: readonly PlaybackRangeFragment[];
}
export interface PlaybackRangePlan {
  target: PlaybackRangeFragment;
  required: readonly PlaybackRangeFragment[];
  ahead: readonly PlaybackRangeFragment[];
}

export const validateRangeIndex = (
  index: PlaybackRangeIndex,
): PlaybackRangeIndex => {
  if (
    !index.sourceGeneration ||
    !Number.isSafeInteger(index.initializationBytes) ||
    index.initializationBytes <= 0 ||
    index.initializationBytes > 1024 * 1024 ||
    !Number.isFinite(index.presentationEnd) ||
    index.presentationEnd <= 0 ||
    index.fragments.length === 0 ||
    index.fragments.length > 10000
  )
    throw Error('RANGE_INVALID_INDEX');
  const fragments = index.fragments.map((row, id) => {
    if (
      row.id !== id ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes <= 0 ||
      row.bytes > 64 * 1024 * 1024 ||
      ![row.videoStart, row.videoEnd, row.sampleStart, row.sampleEnd].every(
        Number.isFinite,
      ) ||
      row.sampleStart < 0 ||
      row.videoStart < row.sampleStart ||
      row.videoEnd <= row.videoStart ||
      row.sampleEnd < row.videoEnd ||
      row.sampleEnd > index.presentationEnd ||
      (id > 0 && row.videoStart !== index.fragments[id - 1].videoEnd) ||
      row.dependencies.length === 0 ||
      row.dependencies.length > 64 ||
      !row.dependencies.includes(id) ||
      new Set(row.dependencies).size !== row.dependencies.length ||
      row.dependencies.some(
        (dep) => !Number.isSafeInteger(dep) || dep < 0 || dep > id,
      )
    )
      throw Error('RANGE_INVALID_COVERAGE');
    return Object.freeze({
      ...row,
      dependencies: Object.freeze([...row.dependencies]),
    });
  });
  if (
    Math.max(...fragments.map((row) => row.sampleEnd)) !== index.presentationEnd
  )
    throw Error('RANGE_UNPROVED_TAIL');
  return Object.freeze({ ...index, fragments: Object.freeze(fragments) });
};

export const planPlaybackRange = (
  index: PlaybackRangeIndex,
  time: number,
  aheadSeconds: number,
): PlaybackRangePlan => {
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    time >= index.presentationEnd ||
    !Number.isFinite(aheadSeconds) ||
    aheadSeconds < 0 ||
    aheadSeconds > 10
  )
    throw Error('RANGE_INVALID_DEMAND');
  // The proved initial empty prefix and final audio tail have no extra video
  // field. They use the first/last interval without shifting media timestamps.
  let low = 0,
    high = index.fragments.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (index.fragments[middle].videoEnd <= time) low = middle + 1;
    else high = middle;
  }
  const target = index.fragments[Math.min(low, index.fragments.length - 1)];
  if (!target) throw Error('RANGE_MISSING_TARGET');
  const requiredIds = new Set(target.dependencies);
  const aheadIds = new Set(requiredIds);
  for (let id = target.id; id < index.fragments.length; id++) {
    const row = index.fragments[id];
    if (row.videoStart > time + aheadSeconds) break;
    for (const dependency of row.dependencies) aheadIds.add(dependency);
  }
  const ordered = (ids: Set<number>): PlaybackRangeFragment[] =>
    [...ids].sort((a, b) => a - b).map((id) => index.fragments[id]);
  return { target, required: ordered(requiredIds), ahead: ordered(aheadIds) };
};
