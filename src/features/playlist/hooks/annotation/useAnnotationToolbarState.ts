import { useEffect, useState } from 'react';
import type { DrawingToolType } from '../../../../types/Playlist';

interface UseAnnotationToolbarStateParams {
  freezeDuration: number;
  minFreezeDuration: number;
}

interface UseAnnotationToolbarStateResult {
  tool: DrawingToolType;
  setTool: React.Dispatch<React.SetStateAction<DrawingToolType>>;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  strokeWidth: number;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  localFreezeDuration: number;
  setLocalFreezeDuration: React.Dispatch<React.SetStateAction<number>>;
  colors: string[];
}

export const useAnnotationToolbarState = ({
  freezeDuration,
  minFreezeDuration,
}: UseAnnotationToolbarStateParams): UseAnnotationToolbarStateResult => {
  const [tool, setTool] = useState<DrawingToolType>('pen');
  const [color, setColor] = useState<string>('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [localFreezeDuration, setLocalFreezeDuration] =
    useState<number>(freezeDuration);

  useEffect(() => {
    setLocalFreezeDuration(
      freezeDuration < minFreezeDuration ? minFreezeDuration : freezeDuration,
    );
  }, [freezeDuration, minFreezeDuration]);

  const colors = [
    '#ff0000',
    '#ff7f00',
    '#ff00ff',
    '#ffff00',
    '#00ff00',
    '#00ffff',
    '#0066ff',
    '#9900ff',
    '#ffffff',
    '#000000',
  ];

  return {
    tool,
    setTool,
    color,
    setColor,
    strokeWidth,
    setStrokeWidth,
    localFreezeDuration,
    setLocalFreezeDuration,
    colors,
  };
};
