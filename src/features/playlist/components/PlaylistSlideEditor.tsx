import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import type { PlaylistItem, PlaylistSlide } from '../../../types/playlist/core';
import { isSlideDuration } from '../../../shared/playlist/playlistSlide';
import { importSlideImage, renderSlideFrame } from '../utils/slideCanvas';

export const PlaylistSlideEditor = ({ caption, initial, onCommit, onClose }: {
  caption: string; initial?: PlaylistItem;
  onCommit: (slide: PlaylistSlide, seconds: number) => void; onClose: () => void;
}): ReactElement => {
  const [title, setTitle] = useState(initial?.slide?.title ?? '');
  const [body, setBody] = useState(initial?.slide?.body ?? '');
  const [image, setImage] = useState(initial?.slide?.image);
  const [seconds, setSeconds] = useState(String(initial?.endTime ?? 5));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const save = useRef(onCommit);
  save.current = onCommit;
  useEffect(() => () => { epoch.current += 1; }, []);
  const run = async (operation: (current: () => boolean) => Promise<void>): Promise<void> => {
    const version = ++epoch.current;
    const current = (): boolean => epoch.current === version;
    setBusy(true);
    setError('');
    try { await operation(current); }
    catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : '画像を確認してください。'); }
    finally { if (current()) setBusy(false); }
  };
  return <Dialog open onClose={onClose} fullWidth aria-label={caption}>
    <DialogTitle>{caption}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField autoFocus label="タイトル" value={title} disabled={busy}
        inputProps={{ maxLength: 80 }} onChange={(event) => setTitle(event.target.value)} />
      <TextField label="本文" multiline minRows={3} value={body} disabled={busy}
        inputProps={{ maxLength: 320 }} onChange={(event) => setBody(event.target.value)} />
      <TextField label="表示秒数" type="number" value={seconds} disabled={busy}
        inputProps={{ min: 1, max: 120, step: 1 }} onChange={(event) => setSeconds(event.target.value)} />
      <Button component="label" disabled={busy}>画像を選択
        <input hidden type="file" accept="image/png,image/jpeg" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void run(async (current) => { const png = await importSlideImage(file); if (current()) setImage(png); });
        }} />
      </Button>
      {image && <><img src={image} alt="スライドの画像" height={100} style={{ objectFit: 'contain' }} />
        <Button disabled={busy} onClick={() => setImage(undefined)}>画像を外す</Button></>}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>キャンセル</Button><Button
      disabled={busy || !title.trim() || !isSlideDuration(Number(seconds))}
      onClick={() => void run(async (current) => {
        const slide = { title: title.trim(), body, image };
        await renderSlideFrame(slide);
        if (current()) { save.current(slide, Number(seconds)); onClose(); }
      })}>確定</Button></DialogActions>
  </Dialog>;
};
