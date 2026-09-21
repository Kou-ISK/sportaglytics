import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface PlaylistNoteDraftParams {
  note: string;
  compact?: boolean;
  onCommit: (note: string, direction?: -1 | 1) => void;
  onCancel?: () => void;
}

export const usePlaylistNoteDraft = ({
  note,
  compact,
  onCommit,
  onCancel,
}: PlaylistNoteDraftParams): {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
} => {
  const [value, setValue] = useState(note);
  const completed = useRef(false);
  const commit = (direction?: -1 | 1): void => {
    if (completed.current) return;
    completed.current = true;
    onCommit(value, direction);
  };
  return {
    value,
    onChange: (next) => {
      completed.current = false;
      setValue(next);
    },
    onBlur: () => commit(),
    onKeyDown: (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        commit();
        return;
      }
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        completed.current = true;
        setValue(note);
        onCancel?.();
      } else if (event.key === 'Tab' && event.ctrlKey) {
        event.preventDefault();
        commit(event.shiftKey ? -1 : 1);
      } else if (
        event.key === 'Enter' &&
        event.ctrlKey &&
        event.target instanceof HTMLTextAreaElement
      ) {
        event.preventDefault();
        event.target.setRangeText(
          '\n',
          event.target.selectionStart,
          event.target.selectionEnd,
          'end',
        );
        completed.current = false;
        setValue(event.target.value);
      } else if (
        event.key === 'Enter' &&
        (event.metaKey || (compact && !event.shiftKey))
      ) {
        event.preventDefault();
        commit();
      }
    },
  };
};
