import type { KeyboardEvent, ReactElement } from 'react';
import { TextField } from '@mui/material';

export interface PlaylistNoteEditorViewProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  autoFocus?: boolean;
  compact?: boolean;
}

export const PlaylistNoteEditorView = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus,
  compact,
}: PlaylistNoteEditorViewProps): ReactElement => (
  <TextField
    fullWidth
    multiline
    size="small"
    autoFocus={autoFocus}
    label={compact ? undefined : 'ノート'}
    slotProps={{ htmlInput: { 'aria-label': 'クリップのノート' } }}
    minRows={compact ? 2 : 3}
    maxRows={8}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onBlur={onBlur}
    onKeyDown={onKeyDown}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    placeholder="伝えたいポイントを入力"
    helperText={
      compact
        ? undefined
        : '入力後に外側をクリックして確定。Escで取消。書き出し時に映像への表示を選べます。'
    }
    sx={{
      '& textarea': { fontSize: 13 },
      '& .MuiFormHelperText-root': { mx: 0 },
    }}
  />
);
