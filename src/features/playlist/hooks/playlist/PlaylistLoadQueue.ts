export interface PlaylistLoadToken {
  generation: number;
  revision: number;
}

/** One renderer's disk load and incoming additions share this delivery boundary. */
export class PlaylistLoadQueue {
  private generation = 0;
  private revision = 0;
  private loading = false;
  private pending: Array<() => void> = [];

  begin(): PlaylistLoadToken {
    this.finishPending();
    this.loading = true;
    return { generation: ++this.generation, revision: this.revision };
  }

  markEdited(): void {
    this.revision++;
  }

  add(deliver: () => void): void {
    if (this.loading) this.pending.push(deliver);
    else deliver();
  }

  replace(deliver: () => void): void {
    this.finishPending();
    this.generation++;
    deliver();
  }

  isCurrent(token: PlaylistLoadToken): boolean {
    return this.loading && token.generation === this.generation;
  }

  complete(token: PlaylistLoadToken, applySnapshot: () => void): void {
    if (!this.isCurrent(token)) return;
    if (token.revision === this.revision) applySnapshot();
    this.finishPending();
  }

  finish(token: PlaylistLoadToken): void {
    if (this.isCurrent(token)) this.finishPending();
  }

  cancel(): void {
    this.generation++;
    this.loading = false;
    this.pending = [];
  }

  private finishPending(): void {
    this.loading = false;
    const pending = this.pending.splice(0);
    for (const deliver of pending) deliver();
  }
}
