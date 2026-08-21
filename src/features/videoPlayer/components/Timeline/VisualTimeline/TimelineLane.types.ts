import type React from 'react';
import type { TimelineData } from '../../../../../types/timeline/core';

export interface TimelineLaneProps {
  rowId: string;
  actionName: string;
  rowColor: string;
  isRowSelected: boolean;
  items: TimelineData[];
  selectedIds: string[];
  hoveredItemId: string | null;
  focusedItemId: string | null;
  onHoverChange: (id: string | null) => void;
  onItemClick: (event: React.MouseEvent, id: string) => void;
  onItemContextMenu: (event: React.MouseEvent, id: string) => void;
  onMoveItem?: (
    ids: string[],
    targetActionName: string,
    operation: 'move' | 'copy',
  ) => void;
  onCreateItem?: (
    actionName: string,
    startTime: number,
    endTime: number,
    color: string,
  ) => void;
  onEditRow?: () => void;
  onRowClick: (event: React.MouseEvent, rowId: string) => void;
  onRowContextMenu: (event: React.MouseEvent, rowId: string) => void;
  onRowDragStart: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  onRowDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onRowDrop: (event: React.DragEvent<HTMLElement>, rowId: string) => void;
  timeToPosition: (time: number) => number;
  positionToTime: (positionPx: number) => number;
  clientXToContentX: (clientX: number) => number;
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

export interface TimelineLaneViewProps extends Omit<
  TimelineLaneProps,
  'laneRef' | 'clientXToContentX'
> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDraggingPlayhead: boolean;
  isEditModifierPressed: boolean;
  isTeam1: boolean;
  laneLabelColor: string;
  draftRange: { startTime: number; endTime: number } | null;
  onLaneDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onLaneDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPlayheadMouseDown: (event: React.MouseEvent) => void;
  onEdgeMouseDown: (
    event: React.MouseEvent,
    item: TimelineData,
    edge: 'start' | 'end',
  ) => void;
}
