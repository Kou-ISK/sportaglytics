/** Incremental ffprobe JSON array reader. Retains one bounded record.
 * Quotes, escapes and nested side data are parsed by JSON.parse. */
export class ProbeJsonSequence {
  private pending = '';
  private phase: 'header' | 'value' | 'separator' | 'end' | 'done' = 'header';
  private count = 0;
  constructor(
    private readonly field: 'frames' | 'packets',
    private readonly consume: (value: unknown) => void,
    private readonly maximumRecordBytes = 65536,
  ) {}
  write(text: string): void {
    this.pending += text;
    for (;;) {
      this.pending = this.pending.trimStart();
      if (this.phase === 'header') {
        const match = new RegExp(
          '^\\{\\s*"' + this.field + '"\\s*:\\s*\\[',
        ).exec(this.pending);
        if (!match) {
          if (this.pending.length > 128) throw Error('CACHE_PROBE_HEADER');
          return;
        }
        this.pending = this.pending.slice(match[0].length);
        this.phase = 'value';
      } else if (this.phase === 'value') {
        if (this.pending.startsWith(']') && this.count === 0) {
          this.pending = this.pending.slice(1);
          this.phase = 'end';
          continue;
        }
        if (!this.pending) return;
        if (this.pending[0] !== '{') throw Error('CACHE_PROBE_RECORD');
        let depth = 0;
        let quoted = false;
        let escaped = false;
        let end = -1;
        for (let i = 0; i < this.pending.length; i++) {
          const character = this.pending[i];
          if (quoted) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') quoted = false;
          } else if (character === '"') quoted = true;
          else if (character === '{') depth++;
          else if (character === '}' && --depth === 0) {
            end = i + 1;
            break;
          }
        }
        const size = end < 0 ? this.pending.length : end;
        if (
          Buffer.byteLength(this.pending.slice(0, size)) >
          this.maximumRecordBytes
        )
          throw Error('CACHE_PROBE_RECORD_LIMIT');
        if (end < 0) return;
        const record: unknown = JSON.parse(this.pending.slice(0, end));
        this.consume(record);
        this.count++;
        this.pending = this.pending.slice(end);
        this.phase = 'separator';
      } else if (this.phase === 'separator') {
        if (!this.pending) return;
        const separator = this.pending[0];
        if (separator !== ',' && separator !== ']')
          throw Error('CACHE_PROBE_SEPARATOR');
        this.pending = this.pending.slice(1);
        this.phase = separator === ',' ? 'value' : 'end';
      } else if (this.phase === 'end') {
        if (!this.pending) return;
        if (this.pending[0] !== '}') throw Error('CACHE_PROBE_END');
        this.pending = this.pending.slice(1);
        this.phase = 'done';
      } else {
        if (this.pending.trim()) throw Error('CACHE_PROBE_TRAILING');
        return;
      }
    }
  }
  finish(): number {
    this.write('');
    if (this.phase !== 'done') throw Error('CACHE_PROBE_TRUNCATED');
    return this.count;
  }
}
