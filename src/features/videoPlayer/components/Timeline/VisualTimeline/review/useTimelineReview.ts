import { useEffect, useMemo, useRef, useState } from 'react';
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
  'onActivate' | 'onEdit' | 'onAddToPlaylist' | 'formatTime'
> => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const matches = useMemo(
    () => searchTimeline(timeline, query),
    [timeline, query],
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const selectedItem =
    selectedIds.length === 1
      ? (timeline.find((item) => item.id === selectedIds[0]) ?? null)
      : null;
  const close = (): void => {
    restoreFocusRef.current = true;
    setOpen(false);
  };
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (restoreFocusRef.current) {
      toggleRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [open]);
  useEffect(() => {
    const find = (event: KeyboardEvent): void => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'f' ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      )
        return;
      event.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', find);
    return () => window.removeEventListener('keydown', find);
  }, []);
  return {
    open,
    query,
    inputRef,
    toggleRef,
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
