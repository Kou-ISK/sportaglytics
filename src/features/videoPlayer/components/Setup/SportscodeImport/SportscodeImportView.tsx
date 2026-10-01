import type { ReactElement } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ParsedSportscodeXml } from './domain/parseSportscodeXml';

export interface SportscodeImportViewProps {
  open: boolean;
  busy: boolean;
  error: string;
  xmlName: string;
  videoName: string;
  name: string;
  offset: string;
  confirmed: boolean;
  preview: ParsedSportscodeXml | null;
  canImport: boolean;
  onSelectXml: () => void;
  onSelectVideo: () => void;
  onNameChange: (value: string) => void;
  onOffsetChange: (value: string) => void;
  onConfirm: (value: boolean) => void;
  onImport: () => void;
  onClose: () => void;
}
export const SportscodeImportView = (
  props: SportscodeImportViewProps,
): ReactElement => (
  <Dialog
    open={props.open}
    onClose={props.busy ? undefined : props.onClose}
    maxWidth="sm"
    fullWidth
    aria-labelledby="sportscode-import-title"
  >
    <DialogTitle id="sportscode-import-title">
      Sportscode XMLから新しいプロジェクト
    </DialogTitle>
    <DialogContent>
      <Stack spacing={1.5} sx={{ pt: 1.5 }}>
        <Typography variant="body2">
          Sportscodeから書き出したXMLと対応する映像を選択します。原本を保持し、映像のコピーとタイムラインを新しい.stpkgへ保存します。.scpkg
          / .sczipは直接開けません。
        </Typography>
        <Button
          variant="outlined"
          disabled={props.busy}
          onClick={props.onSelectXml}
        >
          XMLを選択
        </Button>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {props.xmlName || 'XML未選択'}
        </Typography>
        <Button
          variant="outlined"
          disabled={props.busy}
          onClick={props.onSelectVideo}
        >
          対応する映像を選択
        </Button>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {props.videoName || '映像未選択'}
        </Typography>
        <TextField
          size="small"
          label="新しいプロジェクト名"
          value={props.name}
          disabled={props.busy}
          onChange={(event) => props.onNameChange(event.target.value)}
        />
        <TextField
          size="small"
          label="XML時刻に加える秒数"
          type="number"
          value={props.offset}
          disabled={props.busy}
          onChange={(event) => props.onOffsetChange(event.target.value)}
          helperText="同じ開始位置なら0。開始日時や前後半を推測して補正しません。"
          slotProps={{ htmlInput: { step: 'any' } }}
        />
        {props.preview && (
          <Typography role="status" variant="body2">
            {props.preview.document.rows.length}行 /{' '}
            {props.preview.document.instances.length}場面
            {props.preview.document.instances.length
              ? ` · ${props.preview.document.instances.reduce((time, item) => Math.min(time, item.startTime), Infinity)}〜${props.preview.document.instances.reduce((time, item) => Math.max(time, item.endTime), 0)}秒`
              : ''}
          </Typography>
        )}
        {props.preview?.warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        <FormControlLabel
          control={
            <Checkbox
              checked={props.confirmed}
              disabled={props.busy || !props.preview || !props.videoName}
              onChange={(event) => props.onConfirm(event.target.checked)}
            />
          }
          label="選んだ映像と秒数補正、読み込めない項目を確認しました"
        />
        {props.error && (
          <Alert severity="error">
            {props.error} 元ファイルは変更していません。
          </Alert>
        )}
        {props.busy && (
          <Typography role="status" variant="body2">
            映像をコピーし、時刻とプロジェクトを検証しています…
          </Typography>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button disabled={props.busy} onClick={props.onClose}>
        キャンセル
      </Button>
      <Button
        variant="contained"
        disabled={!props.canImport}
        onClick={props.onImport}
      >
        保存先を選んで作成
      </Button>
    </DialogActions>
  </Dialog>
);
