import type { ReactElement } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { TimelineReviewViewProps } from './TimelineReviewView';

type DetailsProps = Pick<
  TimelineReviewViewProps,
  'selectedItem' | 'detailRef' | 'formatTime'
>;
export const TimelineReviewDetailsView = ({
  selectedItem,
  detailRef,
  formatTime,
}: DetailsProps): ReactElement => (
  <Box
    aria-label="選択した場面の詳細"
    role="region"
    tabIndex={0}
    ref={detailRef}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      overflowY: 'auto',
      borderLeft: 1,
      borderColor: 'divider',
    }}
  >
    {selectedItem ? (
      <>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            px: 1,
            py: 0.25,
            minHeight: 24,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="body2"
            title={selectedItem.actionName}
            sx={{ flex: 1, fontWeight: 600, overflowWrap: 'anywhere' }}
          >
            {selectedItem.actionName}
          </Typography>
        </Stack>
        <Stack spacing={0.5} sx={{ p: 1, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {formatTime(selectedItem.startTime)} –{' '}
            {formatTime(selectedItem.endTime)}
          </Typography>
          {Boolean(selectedItem.labels?.length) && (
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {selectedItem.labels
                ?.map((label) =>
                  label.group ? `${label.group}: ${label.name}` : label.name,
                )
                .join(' · ')}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {selectedItem.memo || 'ノートなし'}
          </Typography>
        </Stack>
      </>
    ) : (
      <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
        結果をクリックまたはEnterで選ぶと、映像へ移動して詳細を表示します。
      </Typography>
    )}
  </Box>
);
