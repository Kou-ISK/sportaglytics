/** One display transaction and one replaceable desired position. Delivery alone
 * must never resolve present(): it includes the image's presentation fence. */
export class HeldSeekQueue {
  private pending: number | null = null;
  private inFlight = false;
  private readonly abort = new AbortController();
  constructor(
    private readonly present: (
      time: number,
      signal: AbortSignal,
    ) => Promise<void>,
    private readonly failed: (error: unknown) => void,
  ) {}
  get settled(): boolean {
    return !this.inFlight && this.pending === null;
  }
  request(time: number): void {
    if (this.abort.signal.aborted) return;
    this.pending = time;
    this.pump();
  }
  cancel(): void {
    this.pending = null;
    this.abort.abort();
  }
  private pump(): void {
    if (this.inFlight || this.pending === null || this.abort.signal.aborted)
      return;
    const time = this.pending;
    this.pending = null;
    this.inFlight = true;
    void this.present(time, this.abort.signal).then(
      () => {
        this.inFlight = false;
        this.pump();
      },
      (error: unknown) => {
        if (this.abort.signal.aborted) return;
        this.cancel();
        this.failed(error);
      },
    );
  }
}
