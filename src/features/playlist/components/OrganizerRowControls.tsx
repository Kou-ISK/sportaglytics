import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, TextField } from '@mui/material';
import { PlaylistSlideEditor } from './PlaylistSlideEditor';
import type { SlidePlacement } from '../../../shared/playlist/editPlaylistSlide';
import type { PlaylistSlide, PlaylistItem, PlaylistRow } from '../../../types/playlist/core';

export interface OrganizerActions {
  saveSlide: (placement: SlidePlacement, slide: PlaylistSlide, seconds: number) => void;
  add: (name: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  reposition: (id: string, delta: 1 | -1) => void;
  moveClips: (ids: string[], rowId: string) => void;
  play: (ids: string[]) => void;
  export: (ids: string[]) => void;
}

export const RowNameEditor = ({ initial, title, onCommit, onClose }: {
  initial: string; title: string; onCommit: (name: string) => void; onClose: () => void;
}): ReactElement => {
  const [value, setValue] = useState(initial);
  return <Dialog open onClose={onClose} aria-label={title}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (value.trim()) { onCommit(value.trim()); onClose(); }
    }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><TextField autoFocus label="行名" value={value}
        onChange={(event) => setValue(event.target.value)} margin="dense" /></DialogContent>
      <DialogActions><Button onClick={onClose}>キャンセル</Button>
        <Button type="submit" disabled={!value.trim()}>確定</Button></DialogActions>
    </form>
  </Dialog>;
};

export const OrganizerRowControls = ({ row, index, rowCount, items, selection, actions }: {
  row: PlaylistRow; index: number; rowCount: number; items: PlaylistItem[];
  selection: Set<string>; actions: OrganizerActions;
}): ReactElement => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const itemIds = items.map((item) => item.id);
  const selected = items.filter((item) => selection.has(item.id));
  const only = selected.length === 1 ? selected[0] : undefined;
  const [editor, setEditor] = useState<{ placement: SlidePlacement; initial?: PlaylistItem; caption: string }>();
  const [renaming, setRenaming] = useState(false);
  const run = (action: () => void): void => { setAnchor(null); action(); };
  return <>
    <Button size="small" aria-label={row.name + ' の行操作'} aria-haspopup="menu"
      onClick={(event) => setAnchor(event.currentTarget)}>行操作</Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => run(() => setRenaming(true))}>行名を変更</MenuItem>
      <MenuItem disabled={index === 0} onClick={() => run(() => actions.reposition(row.id, -1))}>行を上へ</MenuItem>
      <MenuItem disabled={index === rowCount - 1} onClick={() => run(() => actions.reposition(row.id, 1))}>行を下へ</MenuItem>
      <MenuItem disabled={![...selection].some((id) => !itemIds.includes(id))}
        onClick={() => run(() => actions.moveClips([...selection], row.id))}>選択項目をこの行へ移動</MenuItem>
      <MenuItem onClick={() => run(() => setEditor({
        placement: { rowId: row.id },
        caption: items.length ? row.name + ' の先頭に挿入' : row.name + ' に追加（全体の最後）',
      }))}>行の先頭にスライドを追加</MenuItem>
      <MenuItem disabled={!only} onClick={() => only && run(() => setEditor({
        placement: { rowId: row.id, afterId: only.id }, caption: only.actionName + ' の直後に挿入',
      }))}>選択項目の後にスライドを追加</MenuItem>
      <MenuItem disabled={!only?.slide} onClick={() => only?.slide && run(() => setEditor({
        placement: { rowId: row.id, editId: only.id }, initial: only, caption: 'スライドを編集',
      }))}>選択したスライドを編集</MenuItem>
      <MenuItem disabled={!itemIds.length} onClick={() => run(() => actions.play(itemIds))}>この行を再生</MenuItem>
      <MenuItem disabled={!itemIds.length} onClick={() => run(() => actions.export(itemIds))}>この行を MP4 に書き出す</MenuItem>
      <MenuItem disabled={Boolean(itemIds.length) || rowCount <= 1}
        onClick={() => run(() => actions.remove(row.id))}>空の行を削除</MenuItem>
    </Menu>
    {editor && <PlaylistSlideEditor caption={editor.caption} initial={editor.initial}
      onCommit={(slide, seconds) => actions.saveSlide(editor.placement, slide, seconds)}
      onClose={() => setEditor(undefined)} />}
    {renaming && <RowNameEditor title="行名を変更" initial={row.name}
      onCommit={(name) => actions.rename(row.id, name)} onClose={() => setRenaming(false)} />}
  </>;
};
