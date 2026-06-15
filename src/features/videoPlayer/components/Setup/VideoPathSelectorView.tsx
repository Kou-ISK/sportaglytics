import React from 'react';
import { Box, Stack } from '@mui/material';
import { CreatePackageWizard } from './VideoPathSelector/CreatePackageWizard';
import { WelcomeHeader } from './VideoPathSelector/components/WelcomeHeader';
import { DropZoneCard } from './VideoPathSelector/components/DropZoneCard';
import { ActionButtonsRow } from './VideoPathSelector/components/ActionButtonsRow';
import { RecentPackagesSection } from './VideoPathSelector/components/RecentPackagesSection';
import type { PackageLoadResult } from './VideoPathSelector/types';
import type { DragAndDropState } from './VideoPathSelector/hooks/useDragAndDrop';
import type { RecentPackage } from './VideoPathSelector/hooks/useRecentPackages';

interface VideoPathSelectorViewProps {
  showWelcome: boolean;
  dragState: DragAndDropState;
  dragHandlers: React.HTMLAttributes<HTMLDivElement>;
  wizardOpen: boolean;
  recentPackages: RecentPackage[];
  onPackageLoaded: (payload: PackageLoadResult) => void;
  onOpenWizard: () => void;
  onCloseWizard: () => void;
  onPackageCreated: (payload: PackageLoadResult) => void;
  onOpenRecentPackage: (path: string) => void;
  onRemoveRecentPackage: (path: string) => void;
}

export const VideoPathSelectorView: React.FC<VideoPathSelectorViewProps> = ({
  showWelcome,
  dragState,
  dragHandlers,
  wizardOpen,
  recentPackages,
  onPackageLoaded,
  onOpenWizard,
  onCloseWizard,
  onPackageCreated,
  onOpenRecentPackage,
  onRemoveRecentPackage,
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        mx: 'auto',
        mt: 2,
        px: { xs: 2, md: 3 },
        pb: 3,
        maxWidth: 1180,
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
        color: 'text.primary',
        fontFamily: 'inherit',
      }}
      {...dragHandlers}
    >
      <Stack spacing={2.5}>
        <WelcomeHeader show={showWelcome} />

        <ActionButtonsRow
          onPackageLoaded={onPackageLoaded}
          onOpenWizard={onOpenWizard}
        />

        <DropZoneCard dragState={dragState} />

        <RecentPackagesSection
          packages={recentPackages}
          onOpen={onOpenRecentPackage}
          onRemove={onRemoveRecentPackage}
        />
      </Stack>

      <CreatePackageWizard
        open={wizardOpen}
        onClose={onCloseWizard}
        onPackageCreated={onPackageCreated}
      />
    </Box>
  );
};
