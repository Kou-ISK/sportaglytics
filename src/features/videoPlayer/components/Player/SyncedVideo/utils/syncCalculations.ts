const OFFSET_EPSILON = 0.05;

const clampToZero = (value: number) => (value < 0 ? 0 : value);

const isNegativeOffset = (offset: number) => offset < -OFFSET_EPSILON;

export const calculateAdjustedCurrentTimes = (
  videoList: string[],
  primaryClock: number,
  offsets: number[],
): number[] => {
  return videoList.map((_, index) => {
    if (index === 0) {
      return clampToZero(primaryClock);
    }
    const shifted = primaryClock + (offsets[index] ?? 0);
    return clampToZero(shifted);
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

  return videoList.map((_, index) => {
    const offset = offsets[index] ?? 0;
    if (!isNegativeOffset(offset)) return false;
    return primaryClock < Math.abs(offset) - OFFSET_EPSILON;
  });
};
