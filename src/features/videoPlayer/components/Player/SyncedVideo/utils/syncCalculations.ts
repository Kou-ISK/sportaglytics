const OFFSET_EPSILON = 0.05;

const clampToZero = (value: number) => (value < 0 ? 0 : value);

export const isNegativeOffset = (offset: number) => offset < -OFFSET_EPSILON;

export const isPositiveOffset = (offset: number) => offset > OFFSET_EPSILON;

export const calculateAdjustedCurrentTimes = (
  videoList: string[],
  primaryClock: number,
  offset: number,
): number[] => {
  return videoList.map((_, index) => {
    if (index === 0) {
      return clampToZero(primaryClock);
    }
    const shifted = primaryClock + offset;
    return clampToZero(shifted);
  });
};

interface BlockStateParams {
  videoList: string[];
  analyzed: boolean;
  offset: number;
  primaryClock: number;
}

export const calculateBlockStates = ({
  videoList,
  analyzed,
  offset,
  primaryClock,
}: BlockStateParams): boolean[] => {
  if (!analyzed) {
    return videoList.map(() => false);
  }

  // offset < 0 の場合、セカンダリは基準より遅れるため、基準が|offset|に到達するまで再生をブロック
  if (isNegativeOffset(offset)) {
    const threshold = Math.abs(offset) - OFFSET_EPSILON;
    return videoList.map((_, index) =>
      index === 0 ? false : primaryClock < threshold,
    );
  }

  return videoList.map(() => false);
};

export const SYNC_EPSILON = OFFSET_EPSILON;
