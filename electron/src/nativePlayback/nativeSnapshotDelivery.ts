import type {
  NativePlaybackOwner,
  NativePlaybackSnapshot,
} from '../../../src/types/ipc/nativePlayback';
export interface NativeSnapshotNotice {
  owner: NativePlaybackOwner;
  delivery: number;
  snapshot: NativePlaybackSnapshot;
}
/** One sent notice plus the latest unsent snapshot, including across reopen. */
export class NativeSnapshotDelivery {
  private sequence = 0;
  private sent: NativeSnapshotNotice | null = null;
  private pending: Omit<NativeSnapshotNotice, 'delivery'> | null = null;
  constructor(private readonly send: (notice: NativeSnapshotNotice) => void) {}
  publish(owner: NativePlaybackOwner, snapshot: NativePlaybackSnapshot): void {
    this.pending = { owner: { ...owner }, snapshot };
    this.flush();
  }
  acknowledge(owner: NativePlaybackOwner, delivery: number): void {
    if (
      !this.sent ||
      this.sent.delivery !== delivery ||
      this.sent.owner.generation !== owner.generation ||
      this.sent.owner.sourceKey !== owner.sourceKey
    )
      return;
    this.sent = null;
    this.flush();
  }
  resetDocument(): void {
    this.sent = null;
    this.pending = null;
  }
  private flush(): void {
    if (this.sent || !this.pending) return;
    if (this.sequence >= Number.MAX_SAFE_INTEGER)
      throw Error('NATIVE_NOTICE_EXHAUSTED');
    const notice = { ...this.pending, delivery: ++this.sequence };
    this.pending = null;
    this.sent = notice;
    try {
      this.send(notice);
    } catch (error) {
      this.resetDocument();
      throw error;
    }
  }
}
