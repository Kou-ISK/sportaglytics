import type {
  CacheIdentityReadObserver,
  CacheIdentityRead,
} from './sourceIdentity';
export interface CacheMediaReadEvidence {
  records: (CacheIdentityRead & { role: 'source' | 'candidate' })[];
  overflow: boolean;
}
/** Logical digest I/O only: not physical disk traffic, probes, headers or tools. */
export class CacheMediaReadAudit {
  private readonly records: CacheMediaReadEvidence['records'] = [];
  private overflow = false;
  constructor(private readonly source: string) {}
  readonly observe: CacheIdentityReadObserver = (path, read) => {
    if (this.records.length >= 32) {
      this.overflow = true;
      return;
    }
    this.records.push({
      ...read,
      role: path === this.source ? 'source' : 'candidate',
    });
  };
  snapshot(): CacheMediaReadEvidence {
    return structuredClone({ records: this.records, overflow: this.overflow });
  }
}
