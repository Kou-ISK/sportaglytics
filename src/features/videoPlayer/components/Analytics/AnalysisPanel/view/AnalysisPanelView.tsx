import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  CircularProgress,
  Stack,
  Typography,
  Dialog,
  DialogContent,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridOnIcon from '@mui/icons-material/GridOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OutboxIcon from '@mui/icons-material/Outbox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { TimelineData } from '../../../../../../types/TimelineData';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { AnalysisView } from '../AnalysisPanel';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import type { DashboardSeriesFilter } from '../../../../../../types/Settings';
import { MomentumTab } from './MomentumTab';
import { AIAnalysisTab } from './AIAnalysisTab';
import { DashboardTab } from './DashboardTab';
import { MatrixTab } from './MatrixTab';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import { createMomentumDataFactory } from '../../../../analysis/utils/momentum';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  buildAnalysisSummaryText,
  exportAnalysisReportPdf,
} from '../../../../../../utils/analysisExport';
import {
  captureScrollableContent,
  stitchCapturedSlicesIntoParts,
  withExportLayoutOverrides,
} from '../../../../../../utils/fullContentCapture';
import { useSettings } from '../../../../../../hooks/useSettings';
import { extractUniqueGroups } from '../../../../../../utils/labelExtractors';
import {
  createDefaultMatrixFilters,
  type MatrixFilterState,
} from './hooks/matrixFilterUtils';

interface AnalysisPanelViewProps extends AnalysisPanelDerivedState {
  open: boolean;
  onClose: () => void;
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  timeline: TimelineData[];
  onJumpToSegment?: (segment: TimelineData) => void;
  embedded?: boolean;
  isSyncing?: boolean;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
}

const MAX_PNG_PART_HEIGHT = 15000;

const toBase64FromDataUrl = (dataUrl: string): string =>
  dataUrl.split(',')[1] || '';

const splitPath = (filePath: string) => {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { base: filePath, ext: '' };
  }
  return {
    base: filePath.slice(0, dotIndex),
    ext: filePath.slice(dotIndex),
  };
};

const pickInitialAxis = (availableGroups: string[], preferred: string) => {
  if (availableGroups.length === 0) return '';
  if (availableGroups.includes(preferred)) return preferred;
  if (availableGroups.length > 1) return availableGroups[1];
  return availableGroups[0];
};

const getInitialMatrixAxes = (availableGroups: string[]) => {
  const rowValue =
    availableGroups.length === 0
      ? ''
      : availableGroups.includes('actionType')
        ? 'actionType'
        : availableGroups[0];
  const colValue = pickInitialAxis(availableGroups, 'actionResult');

  return {
    row: { type: 'group', value: rowValue } as MatrixAxisConfig,
    column: { type: 'group', value: colValue } as MatrixAxisConfig,
  };
};

export const AnalysisPanelView = ({
  open,
  onClose,
  currentView,
  onChangeView,
  hasTimelineData,
  resolvedTeamNames,
  timeline,
  onJumpToSegment,
  embedded = false,
  isSyncing = false,
  onCreateAiPlaylist,
}: AnalysisPanelViewProps) => {
  const { settings } = useSettings();
  const notification = useNotification();
  const exportTargetRef = useRef<HTMLDivElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [dashboardFilters, setDashboardFilters] =
    useState<DashboardSeriesFilter>({});
  const [matrixFilters, setMatrixFilters] = useState<MatrixFilterState>(
    createDefaultMatrixFilters(),
  );

  const availableGroups = useMemo(
    () => extractUniqueGroups(timeline),
    [timeline],
  );
  const [matrixAxes, setMatrixAxes] = useState<{
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  }>(() => getInitialMatrixAxes(availableGroups));

  useEffect(() => {
    setMatrixAxes(getInitialMatrixAxes(availableGroups));
  }, [availableGroups]);

  const filteredMomentumDataFactory = useMemo(
    () => createMomentumDataFactory(timeline),
    [timeline],
  );

  const summaryForClipboard = useMemo(
    () =>
      buildAnalysisSummaryText({
        view: currentView,
        timeline,
        teamNames: resolvedTeamNames,
      }),
    [currentView, timeline, resolvedTeamNames],
  );

  const closeExportMenu = () => setExportAnchor(null);

  const captureCurrentViewPngParts = useCallback(async (): Promise<
    string[] | null
  > => {
    const api = window.electronAPI;
    const rootTarget = exportTargetRef.current;

    if (!rootTarget) {
      notification.error('スナップショット対象が見つかりません。');
      return null;
    }

    if (!api?.captureWindowRegionAsPng) {
      notification.error('画面キャプチャ機能が利用できません。');
      return null;
    }

    const horizontalMode = currentView === 'matrix' ? 'auto' : 'off';
    const target =
      currentView === 'matrix'
        ? (rootTarget.querySelector<HTMLElement>('.MuiTableContainer-root') ??
          rootTarget)
        : rootTarget;

    try {
      const slices = await withExportLayoutOverrides(target, async () => {
        return captureScrollableContent(
          target,
          (rect) => api.captureWindowRegionAsPng(rect),
          { horizontal: horizontalMode },
        );
      });

      if (slices.length === 0) {
        notification.error('キャプチャ対象のコンテンツがありません。');
        return null;
      }

      const parts = await stitchCapturedSlicesIntoParts(
        slices,
        MAX_PNG_PART_HEIGHT,
      );
      if (parts.length === 0) {
        notification.error('画像の連結に失敗しました。');
        return null;
      }
      return parts;
    } catch (error) {
      console.error('Failed to capture full content:', error);
      notification.error('全内容キャプチャに失敗しました。');
      return null;
    }
  }, [notification, currentView]);

  const handleCopySummary = async () => {
    closeExportMenu();
    const summary = summaryForClipboard;

    const writeByNavigator = async () => {
      if (!navigator?.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(summary);
      return true;
    };

    const writeByTextarea = () => {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    };

    try {
      const ok = (await writeByNavigator()) || writeByTextarea();
      if (ok) {
        notification.success(
          '構造化サマリーをクリップボードにコピーしました。',
        );
      } else {
        notification.error('クリップボードへのコピーに失敗しました。');
      }
    } catch (error) {
      console.error('Failed to copy summary:', error);
      notification.error('クリップボードへのコピーに失敗しました。');
    }
  };

  const handleExportPng = async () => {
    closeExportMenu();

    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeBinaryFile) {
      notification.error('PNGエクスポート機能が利用できません。');
      return;
    }

    const filePath = await api.saveFileDialog(
      `analysis-${currentView}-${new Date().toISOString().slice(0, 10)}.png`,
      [{ name: 'PNG', extensions: ['png'] }],
    );
    if (!filePath) return;

    setIsExporting(true);
    try {
      const parts = await captureCurrentViewPngParts();
      if (!parts || parts.length === 0) return;

      const { base, ext } = splitPath(filePath);
      let allSaved = true;

      for (let i = 0; i < parts.length; i += 1) {
        const targetPath =
          parts.length === 1
            ? filePath
            : `${base}-part${i + 1}${ext || '.png'}`;
        const base64 = toBase64FromDataUrl(parts[i] ?? '');
        if (!base64) {
          allSaved = false;
          break;
        }
        const ok = await api.writeBinaryFile(targetPath, base64);
        if (!ok) {
          allSaved = false;
          break;
        }
      }

      if (allSaved) {
        if (parts.length === 1) {
          notification.success('PNGを保存しました。');
        } else {
          notification.success(
            `PNGを分割保存しました（${parts.length}ファイル）。`,
          );
        }
      } else {
        notification.error('PNG保存に失敗しました。');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    closeExportMenu();

    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.printAnalysisReportPdf) {
      notification.error('PDFエクスポート機能が利用できません。');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportAnalysisReportPdf({
        defaultFileName: `analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        reportContext: {
          timeline,
          resolvedTeamNames,
          currentDashboardFilters: dashboardFilters,
          currentMatrixAxes: matrixAxes,
          currentMatrixFilters: matrixFilters,
          analysisDashboard: settings.analysisDashboard,
        },
      });

      if (result.canceled) {
        return;
      }

      if (result.success) {
        notification.success('PDFを保存しました。');
      } else {
        notification.error('PDF保存に失敗しました。');
      }
    } catch (error) {
      console.error('Failed to export analysis report PDF:', error);
      notification.error('PDFエクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.default',
          pb: 2,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <ToggleButtonGroup
            value={currentView}
            exclusive
            onChange={(_event, value) => {
              if (value && !isExporting) onChangeView(value);
            }}
            size="small"
          >
            <ToggleButton value="dashboard" disabled={isExporting}>
              <DashboardIcon fontSize="small" sx={{ mr: 0.5 }} />
              ダッシュボード
            </ToggleButton>
            <ToggleButton value="momentum" disabled={isExporting}>
              <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
              モメンタム
            </ToggleButton>
            <ToggleButton value="matrix" disabled={isExporting}>
              <GridOnIcon fontSize="small" sx={{ mr: 0.5 }} />
              クロス集計
            </ToggleButton>
            <ToggleButton value="ai" disabled={isExporting}>
              <AutoAwesomeIcon fontSize="small" sx={{ mr: 0.5 }} />
              AI分析
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            startIcon={<OutboxIcon />}
            onClick={(event) => setExportAnchor(event.currentTarget)}
            disabled={isExporting}
          >
            エクスポート
          </Button>
        </Box>
        <Menu
          anchorEl={exportAnchor}
          open={Boolean(exportAnchor)}
          onClose={closeExportMenu}
        >
          <MenuItem
            onClick={() => void handleCopySummary()}
            disabled={isExporting}
          >
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>構造化サマリーをコピー</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => void handleExportPng()}
            disabled={isExporting}
          >
            <ListItemIcon>
              <ImageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>現在タブをPNGで保存（全内容）</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => void handleExportPdf()}
            disabled={isExporting}
          >
            <ListItemIcon>
              <PictureAsPdfIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>分析レポートをPDFで保存</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      <Box ref={exportTargetRef} sx={{ flex: 1, overflow: 'auto' }}>
        {isSyncing && !hasTimelineData && (
          <Stack
            spacing={1}
            sx={{
              p: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              タイムラインを同期中です...
            </Typography>
          </Stack>
        )}

        {!isSyncing && currentView === 'dashboard' && (
          <DashboardTab
            hasData={hasTimelineData}
            timeline={timeline}
            teamNames={resolvedTeamNames}
            emptyMessage="ダッシュボードを表示するにはタイムラインを作成してください。"
            onJumpToSegment={onJumpToSegment}
            dashboardFilters={dashboardFilters}
            onDashboardFiltersChange={setDashboardFilters}
          />
        )}

        {!isSyncing && currentView === 'matrix' && (
          <MatrixTab
            hasData={hasTimelineData}
            timeline={timeline}
            onJumpToSegment={onJumpToSegment}
            emptyMessage="クロス集計を表示するにはタイムラインを作成してください。"
            totalTimelineCount={timeline.length}
            matrixAxes={matrixAxes}
            onMatrixAxesChange={setMatrixAxes}
            matrixFilters={matrixFilters}
            onMatrixFiltersChange={setMatrixFilters}
          />
        )}

        {!isSyncing && currentView === 'momentum' && (
          <MomentumTab
            hasData={hasTimelineData}
            createMomentumData={filteredMomentumDataFactory}
            teamNames={resolvedTeamNames}
            timeline={timeline}
            emptyMessage="モメンタムを表示するにはタイムラインを作成してください。"
            onJumpToSegment={onJumpToSegment}
          />
        )}

        {!isSyncing && currentView === 'ai' && (
          <AIAnalysisTab
            hasData={hasTimelineData}
            timeline={timeline}
            emptyMessage="AI分析を表示するにはタイムラインを作成してください。"
            onCreateAiPlaylist={onCreateAiPlaylist}
            onJumpToSegment={onJumpToSegment}
            totalTimelineCount={timeline.length}
          />
        )}
      </Box>
    </Box>
  );

  if (embedded) {
    return (
      <Box
        sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      disableEnforceFocus
      disableRestoreFocus
    >
      <DialogContent sx={{ pt: 2 }}>{content}</DialogContent>
    </Dialog>
  );
};
