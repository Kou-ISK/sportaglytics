/** One display transaction and one replaceable desired position. Delivery alone
 * must never resolve present(): it includes the image's presentation fence. */
export class HeldSeekQueue {
  private pending: number | null = null;
  private inFlight = false;
  private issued = false;
  private lastConfirmed: number | null = null;
  private idleWaiters = new Set<(settled: boolean) => void>();
  private readonly abort = new AbortController();
  constructor(
    private readonly present: (
      time: number,
      signal: AbortSignal,
    ) => Promise<number | null | void>,
    private readonly failed: (error: unknown) => void,
  ) {}
  get hasIssued(): boolean {
    return this.issued;
  }
  get confirmedTime(): number | null {
    return this.lastConfirmed;
  }
  get settled(): boolean {
    return !this.inFlight && this.pending === null;
  }
  whenIdle(): Promise<boolean> {
    if (this.abort.signal.aborted) return Promise.resolve(false);
    if (this.settled) return Promise.resolve(true);
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }
  private notifyIdle(settled: boolean): void {
    for (const resolve of this.idleWaiters) resolve(settled);
    this.idleWaiters.clear();
  }
  request(time: number): void {
    if (this.abort.signal.aborted) return;
    this.pending = time;
    this.pump();
  }
  discardPending(): void {
    this.pending = null;
  }
  cancel(): void {
    this.pending = null;
    this.abort.abort();
    this.notifyIdle(false);
  }
  private pump(): void {
    if (this.inFlight || this.pending === null || this.abort.signal.aborted)
      return;
    const time = this.pending;
    this.pending = null;
    this.inFlight = true;
    this.issued = true;
    void this.present(time, this.abort.signal).then(
      (confirmed) => {
        if (typeof confirmed === 'number' && Number.isFinite(confirmed))
          this.lastConfirmed = confirmed;
        else this.lastConfirmed = null;
        this.inFlight = false;
        this.pump();
        if (this.settled && !this.abort.signal.aborted) this.notifyIdle(true);
      },
      (error: unknown) => {
        if (this.abort.signal.aborted) return;
        this.cancel();
        this.failed(error);
      },
    );
  }
}
