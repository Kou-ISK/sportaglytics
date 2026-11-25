/** Only used while one visible angle enters its first clip from an empty gap.
 * A single coalescing timer bounds seeks even during a high-rate pointer sweep.
 * All confirmations still come from the ordinary source-checked paired proof.
 */
export class ColdScrubPair {
  private latest: number;
  private flight?: {
    time: number;
    abort: AbortController;
    timer?: ReturnType<typeof setTimeout>;
  };

  constructor(time: number) {
    this.latest = time;
  }

  request(time: number): void {
    this.latest = time;
    const f = this.flight;
    if (!f || f.time === time || f.timer !== undefined) return;
    f.timer = setTimeout(() => {
      f.timer = undefined;
      if (this.flight === f && this.latest !== f.time) f.abort.abort();
    }, 64);
  }

  cancel(): void {
    clearTimeout(this.flight?.timer);
    this.flight?.abort.abort();
    this.flight = undefined;
  }

  async present(
    time: number,
    signal: AbortSignal,
    prove: (time: number, signal: AbortSignal) => Promise<number | null>,
  ): Promise<number | null | undefined> {
    const flight: NonNullable<ColdScrubPair['flight']> = {
      time,
      abort: new AbortController(),
    };
    this.flight = flight;
    const stop = () => flight.abort.abort();
    if (signal.aborted) stop();
    signal.addEventListener('abort', stop, { once: true });
    try {
      const measured = await prove(time, flight.abort.signal);
      return !flight.abort.signal.aborted && this.latest === time
        ? measured
        : undefined;
    } finally {
      signal.removeEventListener('abort', stop);
      clearTimeout(flight.timer);
      if (this.flight === flight) this.flight = undefined;
    }
  }
}
