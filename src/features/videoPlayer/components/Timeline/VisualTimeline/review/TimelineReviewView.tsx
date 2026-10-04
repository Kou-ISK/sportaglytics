import type { ReactElement, RefObject } from 'react';
import { Box } from '@mui/material';
import { TimelineReviewSearchControlsView } from './TimelineReviewSearchControlsView';
import { TimelineReviewResultsView } from './TimelineReviewResultsView';
import { TimelineReviewDetailsView } from './TimelineReviewDetailsView';
import type { TimelineData } from '../../../../../../types/timeline/core';

export interface TimelineReviewViewProps {
  open: boolean;
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  detailRef: RefObject<HTMLDivElement | null>;
  onFocusDetails: () => void;
  actionsAnchor: HTMLElement | null;
  onOpenActions: (anchor: HTMLElement) => void;
  onCloseActions: () => void;
  onRevealInTimeline?: (id: string) => void;
  totalCount: number;
  matchCount: number;
  results: TimelineData[];
  selectedItem: TimelineData | null;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onToggle: () => void;
  onClose: () => void;
  onActivate: (id: string) => void;
  onEdit?: (id: string) => void;
  onAddToPlaylist?: (items: TimelineData[]) => void;
  formatTime: (seconds: number) => string;
}

export const TimelineReviewView = (
  props: TimelineReviewViewProps,
): ReactElement => (
  <Box
    component="aside"
    id="timeline-review"
    aria-label="場面を検索"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
      bgcolor: 'background.paper',
      containerType: 'inline-size',
    }}
  >
    <TimelineReviewSearchControlsView {...props} />
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      }}
    >
      <TimelineReviewResultsView {...props} />
      <TimelineReviewDetailsView {...props} />
    </Box>
  </Box>
);
