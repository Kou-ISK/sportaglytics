import type { ReactElement, RefObject } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Undo from '@mui/icons-material/Undo';
import Redo from '@mui/icons-material/Redo';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import { IconAction } from '../../../../components/ui';
import type {
  TacticalMarker,
  TacticalMarkerKind,
} from '../../../../types/playlist/tacticalBoard';
import type { BoardTool, TacticalBoardEditor } from './useTacticalBoardEditor';
import { TacticalBoardCanvasView } from './TacticalBoardCanvasView';

export interface TacticalBoardViewProps {
  open: boolean;
  editor: TacticalBoardEditor;
  svgRef?: RefObject<SVGSVGElement | null>;
  image: string;
  busy: boolean;
  progress: number;
  error: string;
  candidates: TacticalMarker[] | null;
  canRecognize: boolean;
  recognitionHint: string;
  onClose: () => void;
  onSave: () => void;
  onDetect: () => void;
  onCancelDetection: () => void;
  onImport: () => void;
  onDismissCandidates: () => void;
  onExport: () => void;
  onGoToFrame?: () => void;
  onUseCurrentFrame?: () => void;
}
const tools: { value: BoardTool; label: string }[] = [
  { value: 'select', label: '選択' },
  { value: 'team1', label: 'チームA' },
  { value: 'team2', label: 'チームB' },
  { value: 'neutral', label: '未分類' },
  { value: 'ball', label: 'ボール' },
  { value: 'arrow', label: '矢印' },
];
const isKind = (value: unknown): value is TacticalMarkerKind =>
  typeof value === 'string' &&
  ['team1', 'team2', 'neutral', 'ball'].includes(value);
export const TacticalBoardView = (
  props: TacticalBoardViewProps,
): ReactElement => {
  const { editor } = props;
  const selected = editor.board.markers.find((m) => m.id === editor.selectedId);
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="lg"
      fullWidth
      disableEscapeKeyDown={Boolean(editor.arrowStart)}
      aria-labelledby="tactical-board-title"
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 's'
        ) {
          event.preventDefault();
          event.stopPropagation();
          props.onSave();
        } else editor.onKeyDown(event);
      }}
    >
      <DialogTitle id="tactical-board-title">
        戦術盤{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          クリップ +{editor.board.time.toFixed(2)}秒 ·{' '}
          {editor.board.widthMeters} × {editor.board.lengthMeters} m
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          direction="row"
          useFlexGap
          flexWrap="wrap"
          gap={1}
          alignItems="center"
          mb={1}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={editor.tool}
            aria-label="戦術盤のツール"
            onChange={(_, value: unknown) => {
              const tool = tools.find((t) => t.value === value);
              if (tool) editor.onTool(tool.value);
            }}
          >
            {tools.map((tool) => (
              <ToggleButton
                key={tool.value}
                value={tool.value}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {tool.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconAction
            label="戦術盤を元に戻す"
            icon={<Undo />}
            disabled={!editor.canUndo}
            onClick={editor.onUndo}
          />
          <IconAction
            label="戦術盤をやり直す"
            icon={<Redo />}
            disabled={!editor.canRedo}
            onClick={editor.onRedo}
          />
          <IconAction
            label="戦術盤の選択を削除"
            icon={<DeleteOutline />}
            disabled={!editor.selectedId}
            onClick={editor.onDelete}
          />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 1fr) minmax(260px, 0.85fr)',
            },
            gap: 2,
          }}
        >
          <Box
            sx={{
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
            }}
          >
            <TacticalBoardCanvasView editor={editor} svgRef={props.svgRef} />
          </Box>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {editor.tool === 'arrow'
                ? editor.arrowStart
                  ? '終点をクリック。Escで取り消し。'
                  : '始点と終点をクリックしてください。'
                : editor.tool === 'select'
                  ? '選手をドラッグして移動。矢印キーで微調整、Deleteで削除できます。'
                  : 'ピッチをクリックして配置してください。'}
            </Typography>
            {selected && (
              <Stack spacing={1}>
                <TextField
                  label="番号・ラベル"
                  value={selected.label}
                  slotProps={{ htmlInput: { maxLength: 8 } }}
                  onChange={(e) => editor.onUpdate({ label: e.target.value })}
                />
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={selected.kind}
                  aria-label="選択した選手のチーム"
                  onChange={(_, value: unknown) => {
                    if (isKind(value)) editor.onUpdate({ kind: value });
                  }}
                >
                  {tools
                    .filter((tool) => isKind(tool.value))
                    .map((tool) => (
                      <ToggleButton key={tool.value} value={tool.value}>
                        {tool.label}
                      </ToggleButton>
                    ))}
                </ToggleButtonGroup>
              </Stack>
            )}
            {props.image && (
              <Box
                component="img"
                src={props.image}
                alt="配置元の映像フレーム"
                sx={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'contain',
                  borderRadius: 1,
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {props.recognitionHint}
            </Typography>
            {props.onGoToFrame && (
              <Button onClick={props.onGoToFrame}>戦術盤の時刻へ移動</Button>
            )}
            {props.onUseCurrentFrame && (
              <Button onClick={props.onUseCurrentFrame}>
                現在の映像で戦術盤を作り直す
              </Button>
            )}
            <Button
              variant="outlined"
              disabled={
                !props.canRecognize ||
                props.busy ||
                editor.board.markers.length >= 64
              }
              onClick={props.onDetect}
            >
              映像から配置候補を認識
            </Button>
            <Typography variant="caption" color="text.secondary">
              認識は端末内で実行します。映像のアップロードは行いません。
            </Typography>
            {props.busy && (
              <Stack spacing={1}>
                <LinearProgress
                  aria-label="配置候補の認識"
                  variant={props.progress ? 'determinate' : 'indeterminate'}
                  value={props.progress * 100}
                />
                <Button onClick={props.onCancelDetection}>
                  認識をキャンセル
                </Button>
              </Stack>
            )}
            {props.candidates !== null && (
              <Alert severity={props.candidates.length ? 'info' : 'warning'}>
                {props.candidates.length
                  ? `${props.candidates.length}件の配置候補。未分類の選手として追加し、チームと位置を修正できます。`
                  : 'ピッチ内の候補がありません。較正を確認するか、手動で配置してください。'}
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                  <Button
                    disabled={
                      !props.candidates.length ||
                      editor.board.markers.length >= 64
                    }
                    onClick={props.onImport}
                  >
                    候補を追加（
                    {Math.min(
                      props.candidates.length,
                      64 - editor.board.markers.length,
                    )}
                    ）
                  </Button>
                  <Button onClick={props.onDismissCandidates}>破棄</Button>
                </Stack>
              </Alert>
            )}
            {editor.board.markers.length >= 64 && (
              <Alert severity="info">配置できる対象は64個までです。</Alert>
            )}
            {editor.board.arrows.length >= 64 && (
              <Alert severity="info">矢印は64本まで配置できます。</Alert>
            )}
            {props.error && <Alert severity="error">{props.error}</Alert>}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={props.onExport}>PNG画像を書き出す</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={props.onClose}>キャンセル</Button>
        <Button variant="contained" onClick={props.onSave}>
          戦術盤を保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
