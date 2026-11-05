/** Reverse rates are an input contract, not proof that a decoder displays them. */
export const isPlaybackRate = (rate: number): boolean =>
  Number.isFinite(rate) &&
  ((rate >= 0.25 && rate <= 6) || [-0.5, -2, -4, -6].includes(rate));

export const clockMovedAgainstRate = (
  time: number,
  previous: number,
  rate: number,
): boolean => (rate < 0 ? time > previous : time < previous);
