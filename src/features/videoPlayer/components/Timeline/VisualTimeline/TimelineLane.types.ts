import type React from 'react';
import type { TimelineData } from '../../../../../types/TimelineData';

export interface TimelineLaneProps {
  actionName: string;
  items: TimelineData[];
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  onHoverChange: (id: string | null) => void;
  onItemClick: (event: React.MouseEvent, id: string) => void;
  onItemContextMenu: (event: React.MouseEvent, id: string) => void;
  onMoveItem?: (ids: string[], targetActionName: string) => void;
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  currentTimePosition: number;
  formatTime: (seconds: number) => string;
  firstTeamName: string | undefined;
  onSeek: (time: number) => void;
  maxSec: number;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  laneRef?: (el: HTMLDivElement | null) => void;
  contentWidth?: number;
  zoomScale: number;
}

export interface TimelineLaneViewProps
  extends Omit<TimelineLaneProps, 'laneRef'> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDraggingPlayhead: boolean;
  isAltKeyPressed: boolean;
  isTeam1: boolean;
  laneLabelColor: string;
  onLaneDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onLaneDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPlayheadMouseDown: (event: React.MouseEvent) => void;
  onEdgeMouseDown: (
    event: React.MouseEvent,
    item: TimelineData,
    edge: 'start' | 'end',
  ) => void;
}
