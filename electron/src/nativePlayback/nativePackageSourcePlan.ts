import {
  getMediaTimelineEnd,
  resolveMediaTime,
} from '../../../src/shared/media/mediaTimeline';
import type { MediaTimeline } from '../../../src/shared/media/mediaTimeline';
import { parseNativePackageTimeline } from './nativePackageTimeline';
import {
  openNativePackageAccess,
  inspectNativeLocalFile,
  nativeSourceDigest,
} from './nativeSourceFilesystem';
import type { NativeLocalFile } from './nativeSourceFilesystem';

export interface NativePlannedSource {
  readonly angleId: string;
  readonly clipId: string;
  readonly sourceKey: string;
  readonly path: string;
  readonly url: string;
  readonly durationSeconds: number;
  readonly globalStart: number;
  readonly globalEnd: number;
  readonly sourceTimeOffset: number;
}
export type NativePlannedPosition =
  | {
      readonly angleId: string;
      readonly kind: 'blank';
      readonly globalStart: number;
      readonly globalEnd: number;
    }
  | {
      readonly angleId: string;
      readonly kind: 'source';
      readonly sourceKey: string;
      readonly sourceTime: number;
      readonly sourceTimeOffset: number;
      readonly globalEnd: number;
      readonly globalStart: number;
    };
export interface NativePackageSourcePlan {
  readonly key: string;
  readonly end: number;
  readonly sources: readonly NativePlannedSource[];
  readonly angleIds: readonly string[];
  resolve(time: number): readonly NativePlannedPosition[];
  assertCurrent(): Promise<void>;
}

/** Main-only selected-angle plan. Selection is IDs within the authenticated
 * package, never source paths. This does not authorize a helper/capability. */
export const resolveNativePackageSourcePlan = async (
  packagePath: string,
  selectedAngleIds: readonly string[],
  signal?: AbortSignal,
): Promise<NativePackageSourcePlan> => {
  const selection = [...selectedAngleIds];
  const checkCancellation = (): void => {
    if (signal?.aborted)
      throw Object.assign(new Error('NATIVE_PACKAGE_PLAN_CANCELLED'), {
        cause: signal.reason,
      });
  };
  checkCancellation();
  const access = await openNativePackageAccess(packagePath);
  checkCancellation();
  const angles = parseNativePackageTimeline(access.config, selection);
  const files: NativeLocalFile[] = [];
  const sources: NativePlannedSource[] = [];
  const timelines: Array<{ angleId: string; timeline: MediaTimeline }> = [];
  for (const angle of angles) {
    const timeline: MediaTimeline = {
      offsetSeconds: angle.offsetSeconds,
      clips: [],
    };
    for (const clip of angle.clips) {
      checkCancellation();
      const file = await inspectNativeLocalFile(access.root, clip.reference);
      checkCancellation();
      files.push(file);
      const sourceKey = nativeSourceDigest(
        JSON.stringify([
          access.root,
          angle.id,
          clip.id,
          clip.reference,
          file.revision,
        ]),
      );
      sources.push(
        Object.freeze({
          angleId: angle.id,
          clipId: clip.id,
          sourceKey,
          path: file.path,
          url: file.url,
          durationSeconds: clip.durationSeconds,
          globalStart: clip.timelineStartSeconds - angle.offsetSeconds,
          globalEnd:
            clip.timelineStartSeconds -
            angle.offsetSeconds +
            clip.durationSeconds,
          sourceTimeOffset: angle.offsetSeconds - clip.timelineStartSeconds,
        }),
      );
      timeline.clips.push({ ...clip, source: sourceKey });
    }
    timelines.push({ angleId: angle.id, timeline });
  }
  const end = Math.max(
    ...timelines.map(({ timeline }) => getMediaTimelineEnd(timeline)),
  );
  if (end <= 0 || end > 86400) throw Error('NATIVE_UNSUPPORTED_PACKAGE');
  const assertCurrent = async (): Promise<void> => {
    checkCancellation();
    await access.assertPackageCurrent();
    for (const file of files) {
      checkCancellation();
      await file.assertCurrent();
    }
    await access.assertCurrent();
    checkCancellation();
  };
  await assertCurrent();
  return Object.freeze({
    key: nativeSourceDigest(
      JSON.stringify([
        access.root,
        access.fingerprint,
        selection,
        sources.map((s) => s.sourceKey),
      ]),
    ),
    end,
    sources: Object.freeze(sources),
    angleIds: Object.freeze(angles.map((angle) => angle.id)),
    assertCurrent,
    resolve(time: number): readonly NativePlannedPosition[] {
      checkCancellation();
      if (!Number.isFinite(time) || time < 0 || time > end)
        throw Error('NATIVE_PACKAGE_TIME_RANGE');
      return timelines.map(({ angleId, timeline }): NativePlannedPosition => {
        const active = resolveMediaTime(timeline, time);
        return active
          ? {
              angleId,
              kind: 'source',
              sourceKey: active.clip.source,
              sourceTime: active.sourceTime,
              sourceTimeOffset: active.sourceTimeOffset,
              globalEnd: active.globalEnd,
              globalStart: Math.max(0, -active.sourceTimeOffset),
            }
          : {
              angleId,
              kind: 'blank',
              globalStart: Math.max(
                0,
                ...timeline.clips.map((clip) => {
                  if (clip.durationSeconds === undefined)
                    throw Error('NATIVE_PACKAGE_PLAN_CHANGED');
                  const finish =
                    clip.timelineStartSeconds -
                    timeline.offsetSeconds +
                    clip.durationSeconds;
                  return finish <= time ? finish : 0;
                }),
              ),
              globalEnd: Math.min(
                end,
                ...timeline.clips.map((clip) => {
                  const start =
                    clip.timelineStartSeconds - timeline.offsetSeconds;
                  return start > time ? start : end;
                }),
              ),
            };
      });
    },
  });
};
