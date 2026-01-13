import { Button } from '@mui/material';
import { useState } from 'react';
import videojs from 'video.js';
import React from 'react';

interface CodeButtonProps {
  actionName: string;
  displayName?: string; // ボタンに表示するテキスト（省略時はactionName）
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  color: 'team1' | 'team2';
}

export const CodeButton = ({
  actionName,
  displayName,
  addTimelineData,
  color,
}: CodeButtonProps) => {
  const [isActionButonPushed, setIsActionButtonPushed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const addTimeline = (memo: string) => {
    type VjsNamespace = {
      getPlayer?: (id: string) =>
        | {
            currentTime?: () => number | undefined;
          }
        | undefined;
    };
    const ns = videojs as unknown as VjsNamespace;
    const player = ns.getPlayer?.('video_0');

    if (player) {
      const currentTime = player.currentTime?.();
      if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
        if (!isActionButonPushed) {
          setStartTime(currentTime);
          setPendingLabel(`${actionName} 記録中`);
          setIsActionButtonPushed(true);
          return;
        }

        const newEndTime = currentTime;
        const [begin, end] =
          newEndTime >= startTime
            ? [startTime, newEndTime]
            : [newEndTime, startTime];

        addTimelineData(actionName, begin, end, memo);
        setPendingLabel(null);
        setIsActionButtonPushed(false);
      }
    }
  };

  const getButtonLabel = () => {
    if (pendingLabel) return '記録中...';
    return displayName ?? `${actionName} 開始`;
  };

  return (
    <Button
      sx={{
        width: '100%',
        minHeight: 32,
        fontSize: '0.75rem',
        py: 0.5,
        px: 1,
      }}
      color={color}
      variant={isActionButonPushed ? 'contained' : 'outlined'}
      onClick={() => addTimeline('')}
    >
      {getButtonLabel()}
    </Button>
  );
};
