export interface EmbeddingProvider {
  id: string;
  isEnabled: () => boolean;
  embed: (texts: string[]) => Promise<number[][]>;
}

export class DisabledEmbeddingProvider implements EmbeddingProvider {
  id = 'disabled';
  isEnabled() {
    return false;
  }
  async embed(): Promise<number[][]> {
    return [];
  }
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
};
