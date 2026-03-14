import React from 'react';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridOnIcon from '@mui/icons-material/GridOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OutboxIcon from '@mui/icons-material/Outbox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import type { AnalysisView } from '../../../../../../../types/AnalysisView';

interface AnalysisPanelToolbarProps {
  currentView: AnalysisView;
  onChangeView: (view: AnalysisView) => void;
  isExporting: boolean;
  exportAnchor: HTMLElement | null;
  setExportAnchor: (anchor: HTMLElement | null) => void;
  onCloseExportMenu: () => void;
  onCopySummary: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
}

export const AnalysisPanelToolbar = ({
  currentView,
  onChangeView,
  isExporting,
  exportAnchor,
  setExportAnchor,
  onCloseExportMenu,
  onCopySummary,
  onExportPng,
  onExportPdf,
}: AnalysisPanelToolbarProps) => {
  return (
    <>
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

      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={onCloseExportMenu}
      >
        <MenuItem onClick={onCopySummary} disabled={isExporting}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>構造化サマリーをコピー</ListItemText>
        </MenuItem>
        <MenuItem onClick={onExportPng} disabled={isExporting}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>現在タブをPNGで保存（全内容）</ListItemText>
        </MenuItem>
        <MenuItem onClick={onExportPdf} disabled={isExporting}>
          <ListItemIcon>
            <PictureAsPdfIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>分析レポートをPDFで保存</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
