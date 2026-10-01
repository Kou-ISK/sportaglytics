import type { ReactElement } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material';
import type { TimelineReviewViewProps } from './TimelineReviewView';

type ResultsProps = Pick<
  TimelineReviewViewProps,
  | 'results'
  | 'selectedItem'
  | 'onActivate'
  | 'formatTime'
  | 'totalCount'
  | 'query'
  | 'onQueryChange'
>;
export const TimelineReviewResultsView = ({
  results,
  selectedItem,
  onActivate,
  formatTime,
  totalCount,
  query,
  onQueryChange,
}: ResultsProps): ReactElement => (
  <Box
    sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
  >
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {results.length ? (
        <List dense disablePadding aria-label="場面検索の結果">
          {results.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                component="button"
                type="button"
                aria-pressed={selectedItem?.id === item.id}
                aria-description={[
                  item.labels
                    ?.map((label) =>
                      label.group
                        ? `${label.group}: ${label.name}`
                        : label.name,
                    )
                    .join(' · '),
                  item.memo || 'ノートなし',
                ]
                  .filter(Boolean)
                  .join('。')}
                selected={selectedItem?.id === item.id}
                onClick={() => onActivate(item.id)}
                aria-label={`${item.actionName} ${formatTime(item.startTime)}へ移動`}
                sx={{
                  width: '100%',
                  minWidth: 0,
                  textAlign: 'left',
                  display: 'grid',
                  gridTemplateColumns: '112px minmax(80px,1fr) minmax(0,1.3fr)',
                  gap: 1,
                  minHeight: 32,
                  px: 1,
                  py: 0.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatTime(item.startTime)}–{formatTime(item.endTime)}
                </Typography>
                <Typography
                  variant="body2"
                  title={item.actionName}
                  noWrap
                  sx={{ fontWeight: 600 }}
                >
                  {item.actionName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.memo ||
                    item.labels?.map((label) => label.name).join(' · ') ||
                    'ノートなし'}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Stack spacing={0.5} sx={{ p: 1 }}>
          <Typography variant="body2">
            {totalCount ? '一致する場面がありません' : 'まだタグがありません'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {totalCount
              ? '検索語を短くするか、検索をクリアしてください。'
              : 'コードウィンドウでアクションを開始・終了すると、ここに場面が並びます。'}
          </Typography>
          {query && (
            <Button size="small" onClick={() => onQueryChange('')}>
              検索をクリア
            </Button>
          )}
        </Stack>
      )}
    </Box>
  </Box>
);
