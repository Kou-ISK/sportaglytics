import { useId } from 'react';
import { StudioInspectorHeaderView } from './StudioInspectorHeaderView';
import { studioControlLayout } from './studioControlLayout';
import { TacticsPresetsView } from './TacticsPresetsView';
import type { TacticsPresetProps } from './useTacticsPresets';
import { TacticsChromaView } from './TacticsChromaView';
import type { TacticsChromaProps } from './useTacticsChroma';
import { TacticsMotionView } from './TacticsMotionView';
import { PitchCalibrationView } from './PitchCalibrationView';
import type { PitchCalibrationControls } from './usePitchCalibration';
import { TacticsTrackingView } from './TacticsTrackingView';
import type { TacticsTrackingProps } from './tracking/useTacticsTracking';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import { IconAction } from '../../../components/ui';
import type { AnnotationTarget } from '../../../types/playlist/core';
import type { StudioEditor } from './useStudioEditor';
import { StudioPropertiesView } from './StudioPropertiesView';
import { STUDIO_TOOLS } from './studioGeometry';

export type TacticsInspectorPanel = 'draw' | 'motion' | 'pitch' | 'presets';
export type StudioSidebarViewProps = StudioEditor['inspector'] & {
  panel: TacticsInspectorPanel;
  onOpenBoard?: () => void;
  onPanelChange: (panel: TacticsInspectorPanel) => void;
  tracking?: TacticsTrackingProps;
  pitch?: PitchCalibrationControls;
  chroma?: TacticsChromaProps;
  presets?: TacticsPresetProps;
  target: AnnotationTarget;
  hasSecondary: boolean;
  onTargetChange: (target: AnnotationTarget) => void;
};
export const StudioSidebarView = (
  props: StudioSidebarViewProps,
): ReactElement => {
  const contentId = useId();
  const index = props.objects.findIndex(
    (object) => object.id === props.selectedId,
  );
  return (
    <Box
      component="aside"
      aria-label="Paint Inspector"
      onKeyDown={props.onKeyDown}
      sx={[
        studioControlLayout,
        {
          width: props.inspectorCollapsed ? 40 : 292,
          minWidth: props.inspectorCollapsed ? 40 : 292,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
        },
      ]}
    >
      <StudioInspectorHeaderView {...props} contentId={contentId} />
      <Stack
        id={contentId}
        spacing={2}
        sx={{
          p: 2,
          pt: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: props.inspectorCollapsed ? 'none' : 'flex',
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={props.target}
          onChange={(_, value: AnnotationTarget | null) => {
            if (value) props.onTargetChange(value);
          }}
          aria-label="描画アングル"
        >
          <ToggleButton value="primary">アングル1</ToggleButton>
          <ToggleButton value="secondary" disabled={!props.hasSecondary}>
            アングル2
          </ToggleButton>
        </ToggleButtonGroup>
        {!props.enabled && (
          <Typography role="status" variant="body2" color="text.secondary">
            映像のあるクリップを選択し、プレビューを停止すると編集できます。
          </Typography>
        )}
        {props.renderError && (
          <Typography role="alert" color="error" variant="body2">
            {props.renderError}
          </Typography>
        )}
        <Tabs
          value={props.panel}
          onChange={(_, panel: TacticsInspectorPanel) =>
            props.onPanelChange(panel)
          }
          variant="fullWidth"
          aria-label="Paint 編集パネル"
        >
          <Tab value="draw" label="スタイル" sx={{ minWidth: 0 }} />
          <Tab value="motion" label="動き" sx={{ minWidth: 0 }} />
          {(props.pitch || props.chroma) && (
            <Tab value="pitch" label="ピッチ" sx={{ minWidth: 0 }} />
          )}
          {props.presets && (
            <Tab value="presets" label="素材" sx={{ minWidth: 0 }} />
          )}
        </Tabs>
        {props.panel === 'draw' && (
          <>
            <Box
              component="fieldset"
              disabled={!props.enabled}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              <StudioPropertiesView {...props} />
            </Box>
            {props.selected &&
              props.chroma &&
              ['disc', 'ring', 'linkedDiscs', 'beam'].includes(
                props.selected.type,
              ) && <TacticsChromaView {...props.chroma} />}
            {props.selected && props.tracking && (
              <TacticsTrackingView {...props.tracking} />
            )}
          </>
        )}
        {props.panel === 'motion' && (
          <>
            {!props.selected && (
              <Typography variant="body2" color="text.secondary">
                レイヤーから動かす描画を選択してください。
              </Typography>
            )}
            <Box
              component="fieldset"
              disabled={!props.enabled}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              <TacticsMotionView {...props.motion} />
            </Box>
            {props.tracking && <TacticsTrackingView {...props.tracking} />}
          </>
        )}
        {props.panel === 'presets' && props.presets && (
          <TacticsPresetsView {...props.presets} />
        )}
        {props.panel === 'pitch' && props.onOpenBoard && (
          <Button
            variant="outlined"
            disabled={!props.enabled || props.pitch?.editing}
            onClick={props.onOpenBoard}
          >
            戦術盤を開く
          </Button>
        )}
        {props.panel === 'pitch' && props.chroma && (
          <TacticsChromaView {...props.chroma} />
        )}
        {props.panel === 'pitch' && props.pitch && (
          <PitchCalibrationView {...props.pitch} disabled={!props.enabled} />
        )}
        <Divider />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">
            レイヤー · {props.objects.length}
          </Typography>
          <Stack direction="row">
            <IconAction
              label="前面へ"
              disabled={
                !props.enabled || index < 0 || index >= props.objects.length - 1
              }
              onClick={() => props.onMoveLayer(1)}
              icon={<ArrowUpward fontSize="small" />}
            />
            <IconAction
              label="背面へ"
              disabled={!props.enabled || index <= 0}
              onClick={() => props.onMoveLayer(-1)}
              icon={<ArrowDownward fontSize="small" />}
            />
          </Stack>
        </Stack>
        {props.objects.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            描画はまだありません。
          </Typography>
        ) : (
          <List dense disablePadding aria-label="描画レイヤー">
            {[...props.objects].reverse().map((object) => (
              <ListItem key={object.id} disablePadding>
                <ListItemButton
                  selected={object.id === props.selectedId}
                  onClick={() => props.onSelect(object.id)}
                  sx={{ borderRadius: 1, gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: object.color,
                      border: 1,
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {object.text ||
                      STUDIO_TOOLS.find((tool) => tool.id === object.type)
                        ?.label ||
                      object.type}
                  </Typography>
                  <Typography
                    variant="technical"
                    color="text.secondary"
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {object.timestamp.toFixed(1)}s
                  </Typography>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            startIcon={<ContentCopy />}
            disabled={!props.enabled || !props.selected}
            onClick={props.onDuplicate}
          >
            複製
          </Button>
          <Button
            startIcon={<DeleteOutline />}
            disabled={!props.enabled || !props.selected}
            onClick={props.onDelete}
          >
            削除
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
