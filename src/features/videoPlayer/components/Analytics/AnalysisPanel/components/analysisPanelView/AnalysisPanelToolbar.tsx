import React from 'react';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridOnIcon from '@mui/icons-material/GridOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OutboxIcon from '@mui/icons-material/Outbox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import type { AnalysisView } from '../../../../../../../types/analysis/view';

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
}: AnalysisPanelToolbarProps): React.JSX.Element => {
  return (
    <>
      <Tabs
        aria-label="分析表示"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          maxWidth: '100%',
          minWidth: 0,
          '& .MuiTab-root': {
            typography: 'body1',
            fontWeight: 600,
            minWidth: 0,
            whiteSpace: 'nowrap',
          },
        }}
        value={currentView}
        onChange={(_event, value) => {
          if (value && !isExporting) onChangeView(value);
        }}
      >
        <Tab
          value="dashboard"
          label="ダッシュボード"
          icon={<DashboardIcon fontSize="small" />}
          iconPosition="start"
          disabled={isExporting}
        />
        <Tab
          value="momentum"
          label="モメンタム"
          icon={<TrendingUpIcon fontSize="small" />}
          iconPosition="start"
          disabled={isExporting}
        />
        <Tab
          value="matrix"
          label="クロス集計"
          icon={<GridOnIcon fontSize="small" />}
          iconPosition="start"
          disabled={isExporting}
        />
        <Tab
          value="ai"
          label="AI分析"
          icon={<AutoAwesomeIcon fontSize="small" />}
          iconPosition="start"
          disabled={isExporting}
        />
      </Tabs>

      <Button
        size="small"
        variant="text"
        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
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
