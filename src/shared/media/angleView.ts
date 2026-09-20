/** Playback and synchronization share the same angle IDs and configured shortcuts. */
export const ANGLE_VIEW_MODES = [
  'angle1',
  'angle2',
  'angle3',
  'angle4',
  'angle5',
  'angle6',
  'angle7',
  'angle8',
] as const;
export type VideoViewMode = 'dual' | (typeof ANGLE_VIEW_MODES)[number];

export const angleIndexForHotkey = (id: string): number | null => {
  const index = ANGLE_VIEW_MODES.findIndex((mode) => id === `toggle-${mode}`);
  return index < 0 ? null : index;
};

export const angleIndexForView = (mode: VideoViewMode): number | null =>
  mode === 'dual' ? null : ANGLE_VIEW_MODES.indexOf(mode);
