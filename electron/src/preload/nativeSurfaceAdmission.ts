export interface SurfaceMetadata {
  document: string;
  id: number;
  generation: string;
  nativeGeneration: number;
  seekId: number;
  pts: number;
}
export interface SurfaceAdmission {
  expect: (
    generation: string,
    seekId: number,
    sequence?: number,
    rate?: number,
  ) => void;
  current: (value: SurfaceMetadata) => boolean;
  commit: (value: SurfaceMetadata) => boolean;
  close: () => void;
}
export const createAdmission = (): SurfaceAdmission => {
  let expected: {
    generation: string;
    seekId: number;
    sequence?: number;
    rate?: number;
  } | null = null;
  let document: string | null = null,
    closed = false,
    presented: SurfaceMetadata | null = null;
  const current = (m: SurfaceMetadata): boolean =>
    Boolean(
      !closed &&
      expected &&
      m.generation === expected.generation &&
      m.seekId === expected.seekId &&
      (expected.sequence === undefined ||
        m.nativeGeneration === expected.sequence) &&
      (!document || m.document === document) &&
      (!presented || m.id > presented.id) &&
      (presented?.seekId !== m.seekId ||
        presented.nativeGeneration !== m.nativeGeneration ||
        ((expected.rate ?? 1) < 0
          ? m.pts <= presented.pts
          : m.pts >= presented.pts)),
    );
  return {
    expect: (generation, seekId, sequence, rate) => {
      if (closed) throw Error('closed admission');
      if (
        expected?.generation === generation &&
        (seekId < expected.seekId ||
          (sequence !== undefined &&
            expected.sequence !== undefined &&
            sequence < expected.sequence))
      )
        return;
      expected = { generation, seekId, sequence, rate };
    },
    current,
    commit: (m) => {
      if (!current(m)) return false;
      document = m.document;
      presented = m;
      return true;
    },
    close: () => {
      closed = true;
    },
  };
};
