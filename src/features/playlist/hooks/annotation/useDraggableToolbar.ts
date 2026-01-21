import { useCallback, useEffect, useRef, useState } from 'react';

type Position = { x: number; y: number };

interface UseDraggableToolbarOptions {
  initialPosition: Position;
  padding?: number;
}

export const useDraggableToolbar = ({
  initialPosition,
  padding = 8,
}: UseDraggableToolbarOptions) => {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<Position | null>(null);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const tw = toolbar.offsetWidth || 0;
    const th = toolbar.offsetHeight || 0;
    setPosition((pos) => ({
      x: Math.min(
        Math.max(0, pos.x),
        Math.max(0, window.innerWidth - tw - padding),
      ),
      y: Math.min(
        Math.max(0, pos.y),
        Math.max(0, window.innerHeight - th - padding),
      ),
    }));
  }, [padding]);

  useEffect(() => {
    clampPosition();
    window.addEventListener('resize', clampPosition);
    return () => window.removeEventListener('resize', clampPosition);
  }, [clampPosition]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const toolbarRect = toolbar.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - toolbarRect.left,
      y: event.clientY - toolbarRect.top,
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: MouseEvent) => {
      const offset = dragOffsetRef.current;
      const toolbar = toolbarRef.current;
      if (!toolbar || !offset) return;

      const newX = event.clientX - offset.x;
      const newY = event.clientY - offset.y;
      setPosition({
        x: Math.min(
          Math.max(0, newX),
          Math.max(0, window.innerWidth - (toolbar.offsetWidth || 0) - padding),
        ),
        y: Math.min(
          Math.max(0, newY),
          Math.max(0, window.innerHeight - (toolbar.offsetHeight || 0) - padding),
        ),
      });
    };

    const handleUp = () => {
      setIsDragging(false);
      dragOffsetRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, padding]);

  return {
    toolbarRef,
    position,
    isDragging,
    handleDragStart,
  };
};
