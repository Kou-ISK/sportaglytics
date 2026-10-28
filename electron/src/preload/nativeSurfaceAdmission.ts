export interface SurfaceMetadata {
  document: string;
  id: number;
  generation: string;
  nativeGeneration: number;
  seekId: number;
  pts: number;
}
export interface SurfaceAdmission {
  expect: (generation: string, seekId: number) => void;
  current: (value: SurfaceMetadata) => boolean;
  commit: (value: SurfaceMetadata) => boolean;
  close: () => void;
}
export const createAdmission = (): SurfaceAdmission => {
  let expected: { generation: string; seekId: number } | null = null;
  let document: string | null = null,
    closed = false,
    presented: SurfaceMetadata | null = null;
  const current = (m: SurfaceMetadata): boolean =>
    Boolean(
      !closed &&
      expected &&
      m.generation === expected.generation &&
      m.seekId === expected.seekId &&
      (!document || m.document === document) &&
      (!presented || m.id > presented.id) &&
      (presented?.seekId !== m.seekId || m.pts >= presented.pts),
    );
  return {
    expect: (generation, seekId) => {
      if (closed) throw Error('closed admission');
      if (expected?.generation === generation && seekId < expected.seekId)
        return;
      expected = { generation, seekId };
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
