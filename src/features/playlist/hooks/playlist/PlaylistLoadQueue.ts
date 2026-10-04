interface LoadToken {
  generation: number;
  revision: number;
}

/** One renderer's disk load and incoming additions share this delivery boundary. */
export class PlaylistLoadQueue {
  private generation = 0;
  private revision = 0;
  private loading = false;
  private pending: Array<() => void> = [];

  begin(): LoadToken {
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

  complete(token: LoadToken, applySnapshot: () => void): void {
    if (token.generation !== this.generation) return;
    if (token.revision === this.revision) applySnapshot();
    this.finishPending();
  }

  finish(token: LoadToken): void {
    if (token.generation === this.generation) this.finishPending();
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
