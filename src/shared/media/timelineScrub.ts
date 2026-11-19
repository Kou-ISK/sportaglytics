type ScrubRequest = { time: number; final: boolean };

/** A drag owns one decoder request and one replaceable destination. A pointer
 * release stays behind the running decode, so it cannot starve presentation. */
export class TimelineScrub {
  private pending: ScrubRequest | null = null;
  private running = false;
  private abort = new AbortController();
  private lastTime = 0;
  private ended = false;

  constructor(
    readonly input: string,
    private readonly present: (
      time: number,
      signal: AbortSignal,
      final: boolean,
    ) => Promise<number | null | undefined>,
    private readonly confirm: (time: number) => void,
    private readonly finish: (failed: boolean) => void,
  ) {}

  request(time: number, final: boolean): void {
    this.pending = { time, final };
    this.lastTime = time;
    this.ended = final;
    if (!this.running) void this.run();
  }

  finishPreview(): void {
    if (!this.ended) this.request(this.lastTime, true);
  }

  cancel(): void {
    this.pending = null;
    this.abort.abort();
  }

  private async run(): Promise<void> {
    this.running = true;
    try {
      while (this.pending && !this.abort.signal.aborted) {
        const request = this.pending;
        this.pending = null;
        try {
          const pts = await this.present(request.time, this.abort.signal, request.final);
          if (this.abort.signal.aborted) return;
          // A superseded preview produced no image and cannot advance the coding clock.
          if (pts === undefined) continue;
          // During a drag the measured frame is the coding clock. The final
          // exact seek anchors to the requested instant in its containing frame.
          if (request.final ? !this.pending : !this.ended)
            this.confirm(request.final ? request.time : (pts ?? request.time));
        } catch {
          if (this.abort.signal.aborted) return;
          if (!this.pending && request.final) this.finish(true);
          continue;
        }
        if (request.final && !this.pending) this.finish(false);
      }
    } finally {
      this.running = false;
    }
  }
}
