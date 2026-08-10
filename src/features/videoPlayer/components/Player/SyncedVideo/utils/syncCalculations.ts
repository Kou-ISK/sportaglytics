import {
  clampAngleMediaTime,
  globalTimeToAngleMediaTime,
  shouldBlockAnglePlayback,
} from '../../../../../../types/video/sync';

export const calculateAdjustedCurrentTimes = (
  videoList: string[],
  primaryClock: number,
  offsets: number[],
): number[] => {
  return videoList.map((_, index) => {
    const offset = index === 0 ? 0 : (offsets[index] ?? 0);
    return clampAngleMediaTime(
      globalTimeToAngleMediaTime(primaryClock, offset),
    );
  });
};

interface BlockStateParams {
  videoList: string[];
  analyzed: boolean;
  offsets: number[];
  primaryClock: number;
}

export const calculateBlockStates = ({
  videoList,
  analyzed,
  offsets,
  primaryClock,
}: BlockStateParams): boolean[] => {
  if (!analyzed) {
    return videoList.map(() => false);
  }

  return videoList.map((_, index) =>
    index === 0
      ? false
      : shouldBlockAnglePlayback(primaryClock, offsets[index] ?? 0),
  );
};
