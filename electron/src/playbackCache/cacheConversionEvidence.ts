/** Bounded in-memory diagnostics. They are not IPC, persisted proof, or a gate. */
export class CacheConversionEvidence {
  private bytes = 0;
  private readonly parts: Buffer[] = [];
  private truncated = false;
  observe(chunk: Buffer): void {
    const keep = Math.min(chunk.length, 256 * 1024 - this.bytes);
    if (keep > 0) this.parts.push(Buffer.from(chunk.subarray(0, keep)));
    this.bytes += keep;
    if (keep < chunk.length) this.truncated = true;
  }
  snapshot(): { stderr: string; truncated: boolean } {
    return {
      stderr: Buffer.concat(this.parts).toString('utf8'),
      truncated: this.truncated,
    };
  }
}
