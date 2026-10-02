import type { ReactElement, HTMLAttributes } from 'react';
import { Box, Stack } from '@mui/material';
import { WelcomeHeader } from './VideoPathSelector/components/WelcomeHeader';
import { DropZoneCard } from './VideoPathSelector/components/DropZoneCard';
import { ActionButtonsRow } from './VideoPathSelector/components/ActionButtonsRow';
import { RecentPackagesSection } from './VideoPathSelector/components/RecentPackagesSection';
import { StartStatusView } from './VideoPathSelector/components/StartStatusView';
import type { StartStatusProps } from './VideoPathSelector/components/StartStatusView';
import type { DragAndDropState } from './VideoPathSelector/hooks/useDragAndDrop';
import type { RecentPackage } from './VideoPathSelector/types';
export interface VideoPathSelectorViewProps extends StartStatusProps {
  showWelcome: boolean;
  dragState: DragAndDropState;
  dragHandlers: HTMLAttributes<HTMLDivElement>;
  recentPackages: RecentPackage[];
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onOpenPackage: () => void;
  onOpenWizard: () => void;
  onOpenCapture?: () => void;
  onOpenLegacyPackage?: () => void;
  onOpenSportscode?: () => void;
  onOpenRecentPackage: (path: string) => void;
  onRemoveRecentPackage: (path: string) => void;
}
export const VideoPathSelectorView = (
  props: VideoPathSelectorViewProps,
): ReactElement => (
  <Box
    component="main"
    aria-label="分析を開始"
    aria-busy={props.busy}
    {...props.dragHandlers}
    sx={{
      width: '100%',
      maxWidth: 1040,
      mx: 'auto',
      my: { xs: 1, md: 2 },
      p: { xs: 1.5, sm: 2 },
      color: 'text.primary',
    }}
  >
    <Stack spacing={3}>
      <WelcomeHeader show={props.showWelcome} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            md: '240px minmax(0,1fr)',
          },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Stack
          spacing={2}
          sx={(theme) => ({
            py: 2,
            pr: { md: 2 },
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 },
          })}
        >
          <ActionButtonsRow
            onOpenPackage={props.onOpenPackage}
            onOpenWizard={props.onOpenWizard}
            onOpenCapture={props.onOpenCapture}
            onOpenLegacyPackage={props.onOpenLegacyPackage}
            onOpenSportscode={props.onOpenSportscode}
            disabled={props.busy}
          />
          <DropZoneCard dragState={props.dragState} />
        </Stack>
        <Stack spacing={2} sx={{ py: 2, pl: { md: 3 }, minWidth: 0 }}>
          <StartStatusView {...props} />
          <RecentPackagesSection
            packages={props.recentPackages}
            onOpen={props.onOpenRecentPackage}
            onRemove={props.onRemoveRecentPackage}
            searchQuery={props.searchQuery}
            onSearchChange={props.onSearchChange}
            disabled={props.busy}
          />
        </Stack>
      </Box>
    </Stack>
  </Box>
);
