import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { TimelineReviewViewProps } from './TimelineReviewView';
import { searchTimeline } from './timelineReviewSearch';

const PAGE_SIZE = 40;

export const useTimelineReview = (
  timeline: TimelineData[],
  selectedIds: string[],
  initialQuery = '',
): Omit<
  TimelineReviewViewProps,
  | 'onActivate'
  | 'onEdit'
  | 'onAddToPlaylist'
  | 'onRevealInTimeline'
  | 'formatTime'
> => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);
  const matches = useMemo(
    () => (open ? searchTimeline(timeline, query) : []),
    [open, timeline, query],
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const selectedItem =
    selectedIds.length === 1
      ? (matches.find((item) => item.id === selectedIds[0]) ?? null)
      : null;
  const close = useCallback((): void => {
    restoreFocusRef.current = true;
    setActionsAnchor(null);
    setOpen(false);
  }, []);
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      toggleRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [open]);
  useEffect(() => {
    const find = (event: KeyboardEvent): void => {
      if (event.isComposing || event.defaultPrevented) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="menu"]')
      )
        return;
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        if (query) {
          setQuery('');
          setPage(0);
          inputRef.current?.focus();
        } else close();
        return;
      }
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'f' ||
        event.altKey ||
        event.shiftKey
      )
        return;
      event.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', find);
    return () => window.removeEventListener('keydown', find);
  }, [open, query, close]);
  return {
    open,
    actionsAnchor,
    onOpenActions: setActionsAnchor,
    onCloseActions: () => setActionsAnchor(null),
    query,
    inputRef,
    toggleRef,
    detailRef,
    onFocusDetails: () => {
      detailRef.current?.focus();
      detailRef.current?.scrollIntoView({ block: 'nearest' });
    },
    selectedItem,
    totalCount: timeline.length,
    matchCount: matches.length,
    results: matches.slice(
      currentPage * PAGE_SIZE,
      (currentPage + 1) * PAGE_SIZE,
    ),
    page: currentPage,
    pageCount,
    onPageChange: setPage,
    onQueryChange: (value) => {
      setActionsAnchor(null);
      setQuery(value);
      setPage(0);
    },
    onToggle: () => {
      if (open) close();
      else setOpen(true);
    },
    onClose: close,
  };
};
