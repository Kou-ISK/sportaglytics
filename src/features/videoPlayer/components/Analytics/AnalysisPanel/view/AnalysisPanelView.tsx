import React, { useMemo, useRef, useState } from 'react';
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
import TableViewIcon from '@mui/icons-material/TableView';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageIcon from '@mui/icons-material/Image';
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
  buildAnalysisSummaryText,
  exportAnalysisCsv,
} from '../../../../../../utils/analysisExport';
import { captureSvgAsPngDataUrl } from '../../../../../../utils/chartSnapshot';

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
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  const filteredMomentumDataFactory = useMemo(
    () => createMomentumDataFactory(timeline),
    [timeline],
  );

  const closeExportMenu = () => setExportAnchor(null);

  const handleExportCsv = async () => {
    closeExportMenu();
    if (timeline.length === 0) {
      notification.warning('エクスポート対象のタイムラインがありません。');
      return;
    }
    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeTextFile) {
      notification.error('CSVエクスポート機能が利用できません。');
      return;
    }
    const filePath = await api.saveFileDialog(
      `analysis-${currentView}-${new Date().toISOString().slice(0, 10)}.csv`,
      [{ name: 'CSV', extensions: ['csv'] }],
    );
    if (!filePath) return;
    const csv = exportAnalysisCsv(timeline);
    const ok = await api.writeTextFile(filePath, csv);
    if (ok) {
      notification.success('CSVを保存しました。');
    } else {
      notification.error('CSV保存に失敗しました。');
    }
  };

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
        notification.success('サマリーをクリップボードにコピーしました。');
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
    const target = exportTargetRef.current;
    if (!target) {
      notification.error('スナップショット対象が見つかりません。');
      return;
    }
    let dataUrl: string | null = null;
    try {
      dataUrl = await captureSvgAsPngDataUrl(target);
    } catch (error) {
      console.error('Failed to create PNG snapshot:', error);
      notification.error('PNGスナップショットの生成に失敗しました。');
      return;
    }
    if (!dataUrl) {
      notification.warning('この画面にはPNG化できるチャートがありません。');
      return;
    }
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
    const base64 = dataUrl.split(',')[1];
    if (!base64) {
      notification.error('PNGデータの生成に失敗しました。');
      return;
    }
    const ok = await api.writeBinaryFile(filePath, base64);
    if (ok) {
      notification.success('PNGを保存しました。');
    } else {
      notification.error('PNG保存に失敗しました。');
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
          <MenuItem onClick={() => void handleExportCsv()}>
            <ListItemIcon>
              <TableViewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>CSV（raw + aggregate）</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => void handleCopySummary()}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy summary</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => void handleExportPng()}>
            <ListItemIcon>
              <ImageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Snapshot PNG</ListItemText>
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
