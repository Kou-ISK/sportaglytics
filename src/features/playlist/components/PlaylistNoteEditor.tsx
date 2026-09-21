import type { ReactElement } from 'react';
import {
  usePlaylistNoteDraft,
  type PlaylistNoteDraftParams,
} from '../hooks/playlist/usePlaylistNoteDraft';
import { PlaylistNoteEditorView } from './PlaylistNoteEditorView';

export const PlaylistNoteEditor = (
  props: PlaylistNoteDraftParams & { autoFocus?: boolean; compact?: boolean },
): ReactElement => {
  const editor = usePlaylistNoteDraft(props);
  return (
    <PlaylistNoteEditorView
      {...editor}
      autoFocus={props.autoFocus}
      compact={props.compact}
    />
  );
};
