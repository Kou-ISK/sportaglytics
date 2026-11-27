import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineData } from '../../../../types/timeline/core';

interface InstanceReviewOptions {
  clock: number;
  playing: boolean;
  seek: (event: Event, time: number) => void;
  setPlaying: (value: boolean) => void;
  revision: number;
}

interface Review {
  items: TimelineData[];
  index: number;
  revision: number;
}

export function useInstanceReview({
  clock,
  playing,
  seek,
  setPlaying,
  revision,
}: InstanceReviewOptions) {
  const current = useRef<Review | null>(null);
  const [active, setActive] = useState<Review | null>(null);
  const entered = useRef(false);

  const stop = useCallback(() => {
    if (!current.current) return;
    current.current = null;
    entered.current = false;
    setActive(null);
    setPlaying(false);
  }, [setPlaying]);

  const move = useCallback(
    (next: Review) => {
      current.current = next;
      entered.current = false;
      setActive(next);
      seek(new Event('instance-review'), next.items[next.index].startTime);
      setPlaying(true);
    },
    [seek, setPlaying],
  );

  const start = useCallback(
    (items: TimelineData[]) => {
      const valid = items.filter(
        ({ startTime, endTime }) =>
          Number.isFinite(startTime) &&
          Number.isFinite(endTime) &&
          startTime >= 0 &&
          endTime > startTime,
      );
      if (valid.length > 0) move({ items: valid, index: 0, revision });
    },
    [move, revision],
  );

  useEffect(() => {
    const review = current.current;
    if (!review) return;
    if (review.revision !== revision) {
      stop();
      return;
    }
    const clip = review.items[review.index];
    if (!entered.current) {
      entered.current = clock >= clip.startTime && clock < clip.endTime;
      return;
    }
    if (!playing || clock < clip.endTime) return;
    const index = review.index + 1;
    if (index === review.items.length) stop();
    else move({ ...review, index });
  }, [clock, move, playing, revision, stop]);

  return { active, start, stop };
}
