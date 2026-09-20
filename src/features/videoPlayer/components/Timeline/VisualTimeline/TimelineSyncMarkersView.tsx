import type { ReactElement } from 'react';
import { Box } from '@mui/material';
import type { AngleSyncSnapshot } from '../../../../../types/ipc/angleSync';

/** Sync points decorate the existing ruler without shifting Coding rows. */
export const TimelineSyncMarkersView = ({
  state,
  timeToPosition,
}: {
  state: AngleSyncSnapshot;
  timeToPosition: (time: number) => number;
}): ReactElement => (
  <>
    {state.angles.map((angle, index) =>
      angle.point === null ? null : (
        <Box
          key={index}
          aria-label={`${angle.name}の同期点`}
          title={`${angle.name} / ${angle.point.toFixed(3)}s`}
          sx={{
            position: 'absolute',
            left: timeToPosition(angle.point),
            bottom: 0,
            lineHeight: 1,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'primary.main',
          }}
        >
          ◆
        </Box>
      ),
    )}
  </>
);
