import { createContext } from 'react';
import type { NativePlaybackPanelViewProps } from './NativePlaybackPanelView';

/** Existing transport hosts audio controls regardless of the playback engine. */
export const NativePlaybackControlsContext =
  createContext<NativePlaybackPanelViewProps | null>(null);
