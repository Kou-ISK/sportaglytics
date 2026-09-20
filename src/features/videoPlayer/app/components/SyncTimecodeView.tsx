import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { InputBase } from '@mui/material';
import { formatSyncTime } from '../hooks/sync/clipSyncPresentation';

/** Text editing stays local until Enter/blur; playback never overwrites an edit. */
export const SyncTimecodeView = (props: {
  time: number;
  disabled: boolean;
  onSeek: (time: number) => void;
}): ReactElement => {
  const [edit, setEdit] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = (): void => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (edit === null) return;
    const value = edit.replace('−', '-').trim();
    const sign = value.startsWith('-') ? -1 : 1;
    const fields = value.replace(/^[+-]/, '').split(':').map(Number);
    const time =
      value && fields.every(Number.isFinite) && fields.length <= 2
        ? sign * (fields.length === 1 ? fields[0] : fields[0] * 60 + fields[1])
        : NaN;
    if (Number.isFinite(time)) props.onSeek(time);
    setEdit(null);
  };
  return (
    <InputBase
      value={edit ?? formatSyncTime(props.time)}
      disabled={props.disabled}
      inputProps={{ 'aria-label': '再生タイムコード', spellCheck: false }}
      onFocus={() => setEdit(formatSyncTime(props.time))}
      onChange={(event) => setEdit(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          if (event.target instanceof HTMLInputElement) event.target.blur();
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          setEdit(null);
          event.stopPropagation();
          if (event.target instanceof HTMLInputElement) event.target.blur();
        }
      }}
      sx={{
        width: 82,
        flexShrink: 0,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        '& input': { py: 0.25, textAlign: 'right' },
      }}
    />
  );
};
