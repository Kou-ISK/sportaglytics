import { PlaylistMediaStatusView } from '../media/PlaylistMediaStatusView';
import { TacticalBoardView } from '../studio/board/TacticalBoardView';
import { StudioToolsView } from '../studio/StudioToolsView';
import { PitchCalibrationOverlayView } from '../studio/PitchCalibrationOverlayView';
import { TacticsTimelineView } from '../studio/TacticsTimelineView';
import { PlaylistReviewView } from './PlaylistReviewView';
import { StudioCoachView } from '../studio/StudioCoachView';
import { StudioCanvasView } from '../studio/StudioCanvasView';
import { StudioSidebarView } from '../studio/StudioSidebarView';
import { StudioTransportView } from '../studio/StudioTransportView';
import { StudioClipsView } from '../studio/StudioClipsView';
import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { PlaylistWindowController } from '../hooks/playlist/usePlaylistWindowController';
import { PlaylistHeaderToolbar } from './PlaylistHeaderToolbar';
import { PlaylistItemSection } from './PlaylistItemSection';
import { PlaylistVideoArea } from './PlaylistVideoArea';
import { PlaylistWindowDialogs } from './PlaylistWindowDialogs';
import { PlaylistClipInspector } from './PlaylistClipInspector';
import { PlaylistWorkspaceSplitter } from './PlaylistWorkspaceSplitter';
import { PlaylistSorterView } from './PlaylistSorterView';
import { PlaylistOrganizerView } from './PlaylistOrganizerView';

type PlaylistWindowViewProps = {
  controller: PlaylistWindowController;
};

export const PlaylistWindowView = ({ controller }: PlaylistWindowViewProps) => {
  const theme = useTheme();

  return (
    <Box
      ref={controller.containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <PlaylistHeaderToolbar {...controller.header} />
      <PlaylistMediaStatusView {...controller.mediaStatus} />

      <Box
        data-testid="playlist-review-area"
        sx={{
          display: 'flex',
          minHeight: 220,
          flex: controller.studio.active
            ? 1
            : `0 0 ${controller.shell.workspaceRatio * 100}%`,
          overflow: 'hidden',
        }}
      >
        <PlaylistReviewView
          onKeyDown={
            controller.studio.active
              ? controller.studio.sidebar.onKeyDown
              : undefined
          }
          tools={
            controller.studio.active &&
            !controller.studio.coachMode && (
              <StudioToolsView
                tool={controller.studio.sidebar.tool}
                onChange={controller.studio.sidebar.onToolChange}
                disabled={!controller.studio.sidebar.enabled}
              />
            )
          }
          media={
            <PlaylistVideoArea
              {...controller.videoArea}
              studioOverlay={
                controller.studio.active ? (
                  <>
                    <StudioCanvasView {...controller.studio.canvas} />
                    {controller.studio.sidebar.panel === 'pitch' && (
                      <PitchCalibrationOverlayView
                        pitch={controller.studio.pitch}
                        width={controller.studio.canvas.width}
                        height={controller.studio.canvas.height}
                        contentRect={controller.studio.contentRect}
                      />
                    )}
                  </>
                ) : undefined
              }
            />
          }
          transport={
            controller.studio.active ? (
              <>
                <StudioTransportView {...controller.studio.transport} />
                {controller.studio.coachMode && (
                  <StudioCoachView {...controller.studio.coach} />
                )}
                {!controller.studio.coachMode && (
                  <TacticsTimelineView {...controller.studio.timeline} />
                )}
              </>
            ) : undefined
          }
          inspector={
            controller.studio.active ? (
              controller.studio.coachMode ? null : (
                <StudioSidebarView {...controller.studio.sidebar} />
              )
            ) : controller.shell.inspectorVisible ? (
              <PlaylistClipInspector {...controller.inspector} />
            ) : null
          }
        />
      </Box>

      {!controller.studio.active && (
        <PlaylistWorkspaceSplitter
          onRatioChange={controller.shell.onWorkspaceRatioChange}
        />
      )}

      <Box
        component="section"
        data-testid="playlist-workspace"
        aria-label={`${controller.shell.workspaceMode} workspace`}
        sx={{
          minHeight: controller.studio.active ? 108 : 160,
          flex: controller.studio.active ? '0 0 108px' : 1,
          overflow: 'auto',
          bgcolor: theme.palette.background.default,
        }}
      >
        {controller.studio.active ? (
          <StudioClipsView {...controller.studio.clips} />
        ) : controller.shell.workspaceMode === 'sorter' ? (
          <PlaylistSorterView {...controller.sorter} />
        ) : controller.shell.workspaceMode === 'organizer' ? (
          <PlaylistOrganizerView {...controller.organizer} />
        ) : (
          <PlaylistItemSection {...controller.itemSection} />
        )}
      </Box>

      <TacticalBoardView {...controller.studio.board} />
      <PlaylistWindowDialogs {...controller.dialogs} />
    </Box>
  );
};
