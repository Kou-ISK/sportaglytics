import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { AnalysisView } from '../AnalysisPanel';
import type { AnalysisPanelDerivedState } from '../hooks/useAnalysisPanelState';
import { MomentumTab } from './MomentumTab';
import { AIAnalysisTab } from './AIAnalysisTab';
import { DashboardTab } from './DashboardTab';
import { MatrixTab } from './MatrixTab';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import { createMomentumDataFactory } from '../../../../analysis/utils/momentum';
import { useNotification } from '../../../../../../contexts/NotificationContext';
import {
  buildAnalysisPdfHtml,
  buildAnalysisSummaryText,
  type AnalysisPdfImagePage,
} from '../../../../../../utils/analysisExport';

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

const PDF_TABS: Array<{ view: Exclude<AnalysisView, 'ai'>; title: string }> = [
  { view: 'dashboard', title: 'Dashboard' },
  { view: 'momentum', title: 'Momentum' },
  { view: 'matrix', title: 'Matrix' },
];

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

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
  const notification = useNotification();
  const exportTargetRef = useRef<HTMLDivElement | null>(null);
  const currentViewRef = useRef<AnalysisView>(currentView);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const filteredMomentumDataFactory = useMemo(
    () => createMomentumDataFactory(timeline),
    [timeline],
  );

  const closeExportMenu = () => setExportAnchor(null);

  const waitForViewAndRender = useCallback(async (targetView: AnalysisView) => {
    let retries = 60;
    while (currentViewRef.current !== targetView && retries > 0) {
      await waitMs(25);
      retries -= 1;
    }
    if (currentViewRef.current !== targetView) return false;
    await waitForPaint();
    await waitMs(80);
    return true;
  }, []);

  const captureCurrentViewAsBase64 = useCallback(async () => {
    const api = window.electronAPI;
    const target = exportTargetRef.current;

    if (!target) {
      notification.error('スナップショット対象が見つかりません。');
      return null;
    }

    if (!api?.captureWindowRegionAsPng) {
      notification.error('画面キャプチャ機能が利用できません。');
      return null;
    }

    const rect = target.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));

    if (width <= 0 || height <= 0) {
      notification.error('キャプチャ領域のサイズが不正です。');
      return null;
    }

    return api.captureWindowRegionAsPng({
      x: Math.floor(rect.left),
      y: Math.floor(rect.top),
      width,
      height,
    });
  }, [notification]);

  const handleCopySummary = async () => {
    closeExportMenu();
    const summary = buildAnalysisSummaryText({
      view: currentView,
      timeline,
      teamNames: resolvedTeamNames,
    });
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
        notification.success('構造化サマリーをクリップボードにコピーしました。');
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

    const base64 = await captureCurrentViewAsBase64();
    if (!base64) {
      notification.error('PNGスナップショットの生成に失敗しました。');
      return;
    }

    const filePath = await api.saveFileDialog(
      `analysis-${currentView}-${new Date().toISOString().slice(0, 10)}.png`,
      [{ name: 'PNG', extensions: ['png'] }],
    );
    if (!filePath) return;

    const ok = await api.writeBinaryFile(filePath, base64);
    if (ok) {
      notification.success('PNGを保存しました。');
    } else {
      notification.error('PNG保存に失敗しました。');
    }
  };

  const handleExportPdf = async () => {
    closeExportMenu();

    if (timeline.length === 0) {
      notification.warning('エクスポート対象のタイムラインがありません。');
      return;
    }

    const api = window.electronAPI;
    if (
      !api?.saveFileDialog ||
      !api?.writePdfFileFromHtml ||
      !api?.captureWindowRegionAsPng
    ) {
      notification.error('PDFエクスポート機能が利用できません。');
      return;
    }

    const filePath = await api.saveFileDialog(
      `analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      [{ name: 'PDF', extensions: ['pdf'] }],
    );
    if (!filePath) return;

    const previousView = currentViewRef.current;
    const pages: AnalysisPdfImagePage[] = [];

    try {
      for (const tab of PDF_TABS) {
        if (currentViewRef.current !== tab.view) {
          onChangeView(tab.view);
        }
        const settled = await waitForViewAndRender(tab.view);
        if (!settled) {
          throw new Error(`Failed to switch view: ${tab.view}`);
        }

        const base64 = await captureCurrentViewAsBase64();
        if (!base64) {
          throw new Error(`Failed to capture view: ${tab.view}`);
        }

        pages.push({
          title: tab.title,
          dataUrl: `data:image/png;base64,${base64}`,
        });
      }

      if (pages.length !== PDF_TABS.length) {
        throw new Error('Incomplete snapshot pages for PDF');
      }

      const generatedAt = new Date().toISOString();
      const summaryText = buildAnalysisSummaryText({
        view: previousView,
        timeline,
        teamNames: resolvedTeamNames,
      });
      const html = buildAnalysisPdfHtml({
        summaryText,
        generatedAtIso: generatedAt,
        pages,
      });

      const ok = await api.writePdfFileFromHtml(filePath, html);
      if (ok) {
        notification.success('PDFを保存しました。');
      } else {
        notification.error('PDF保存に失敗しました。');
      }
    } catch (error) {
      console.error('Failed to export analysis PDF:', error);
      notification.error('PDFエクスポートに失敗しました。');
    } finally {
      if (currentViewRef.current !== previousView) {
        onChangeView(previousView);
        await waitForViewAndRender(previousView);
      }
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
              if (value) onChangeView(value);
            }}
            size="small"
          >
            <ToggleButton value="dashboard">
              <DashboardIcon fontSize="small" sx={{ mr: 0.5 }} />
              ダッシュボード
            </ToggleButton>
            <ToggleButton value="momentum">
              <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
              モメンタム
            </ToggleButton>
            <ToggleButton value="matrix">
              <GridOnIcon fontSize="small" sx={{ mr: 0.5 }} />
              クロス集計
            </ToggleButton>
            <ToggleButton value="ai">
              <AutoAwesomeIcon fontSize="small" sx={{ mr: 0.5 }} />
              AI分析
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            startIcon={<OutboxIcon />}
            onClick={(event) => setExportAnchor(event.currentTarget)}
          >
            エクスポート
          </Button>
        </Box>
        <Menu
          anchorEl={exportAnchor}
          open={Boolean(exportAnchor)}
          onClose={closeExportMenu}
        >
          <MenuItem onClick={() => void handleCopySummary()}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy structured summary</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => void handleExportPng()}>
            <ListItemIcon>
              <ImageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Snapshot PNG（現在タブ）</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => void handleExportPdf()}>
            <ListItemIcon>
              <PictureAsPdfIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Analysis PDF（dashboard/momentum/matrix）</ListItemText>
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
          />
        )}

        {!isSyncing && currentView === 'matrix' && (
          <MatrixTab
            hasData={hasTimelineData}
            timeline={timeline}
            onJumpToSegment={onJumpToSegment}
            emptyMessage="クロス集計を表示するにはタイムラインを作成してください。"
            totalTimelineCount={timeline.length}
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
