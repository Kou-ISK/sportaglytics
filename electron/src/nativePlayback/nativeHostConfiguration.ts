import type { NativePackageSourcePlan } from './nativePackageSourcePlan';

/** Main supplies only the qualified source. AVPlayer owns its media pipeline. */
export const nativeHostConfiguration = (
  source: string,
): { version: 1; source: string } => ({ version: 1, source });

export interface NativeGroupHostConfiguration {
  version: 2;
  mode: 'placed-pair-decoded-samples';
  audioAngle: number;
  sources: Array<{
    path: string;
    sourceRevision: string;
    sourceIndex: number;
    sourceEpoch: number;
    globalStart: number;
    globalEnd: number;
    sourceOffset: number;
  }>;
}
/** Internal Main adapter for the first placed-pair Host. It intentionally
 * rejects multi-clip/gap plans; this is not a full package capability or a
 * renderer source-path grant. The caller must verify resources and the plan. */
export const nativeGroupHostConfiguration = (
  plan: NativePackageSourcePlan,
  audioAngleId: string,
): NativeGroupHostConfiguration => {
  if (
    plan.angleIds.length !== 2 ||
    new Set(plan.angleIds).size !== 2 ||
    plan.sources.length !== 2
  )
    throw Error('NATIVE_GROUP_HOST_PLAN_SCOPE');
  const audioAngle = plan.angleIds.indexOf(audioAngleId);
  if (audioAngle < 0) throw Error('NATIVE_GROUP_HOST_AUDIO_OWNER');
  const maximum = 86400 * 120000;
  const sources = plan.angleIds.map((angleId) => {
    const matches = plan.sources
      .map((source, sourceIndex) => ({ source, sourceIndex }))
      .filter(({ source }) => source.angleId === angleId);
    if (matches.length !== 1) throw Error('NATIVE_GROUP_HOST_PLAN_SCOPE');
    const { source, sourceIndex } = matches[0];
    const globalStart = Math.max(0, Math.round(source.globalStart * 120000)),
      globalEnd = Math.round(source.globalEnd * 120000),
      sourceOffset = Math.round(source.sourceTimeOffset * 120000);
    if (
      typeof source.revision !== 'string' ||
      source.revision.length > 256 ||
      !/^\d+:\d+:\d+:-?\d+:-?\d+:\d+$/.test(source.revision) ||
      !source.path.startsWith('/') ||
      source.path.includes('\0') ||
      source.path.length > 4096 ||
      ![globalStart, globalEnd, sourceOffset].every(Number.isSafeInteger) ||
      globalEnd > maximum ||
      globalStart >= globalEnd ||
      Math.abs(sourceOffset) > maximum ||
      globalStart + sourceOffset < 0 ||
      globalEnd + sourceOffset > maximum
    )
      throw Error('NATIVE_GROUP_HOST_PLAN_RANGE');
    return {
      path: source.path,
      sourceRevision: source.revision,
      sourceIndex,
      sourceEpoch: 1,
      globalStart,
      globalEnd,
      sourceOffset,
    };
  });
  if (
    Math.max(...sources.map((s) => s.globalStart)) >=
    Math.min(...sources.map((s) => s.globalEnd))
  )
    throw Error('NATIVE_GROUP_HOST_PLAN_NO_OVERLAP');
  return {
    version: 2,
    mode: 'placed-pair-decoded-samples',
    audioAngle,
    sources,
  };
};
