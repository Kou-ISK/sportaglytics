import type { TimelineData } from '../../../../../../types/timeline/core';
import { createTemplateDashboardWidgets } from '../../../../../../types/settings/defaults';

// Japanese actions and canonical Result/Type groups intentionally match the saved template.
const matchingRows = [
  'Red ポゼッション',
  'Red スクラム',
  'Red キック',
  'Blue ポゼッション',
  'Blue ラインアウト',
  'Blue PK',
];
const incompatibleRows = [
  'Red Attack',
  'Red Tackle',
  'Red Kick',
  'Blue Attack',
  'Blue Tackle',
  'Blue Set piece',
];

export const reviewTimeline: TimelineData[] = Array.from(
  { length: 24 },
  (_, index) => ({
    id: `synthetic-${index}`,
    actionName: matchingRows[index % 6],
    startTime: 1 + (index % 8) * 7,
    endTime: 5 + (index % 8) * 7,
    memo: `合成場面 ${index + 1}`,
    labels: [
      { group: 'Result', name: index % 2 ? 'Try' : '継続' },
      { group: 'Type', name: index % 2 ? '中央' : 'サイド' },
    ],
  }),
);

export const incompatibleReviewTimeline: TimelineData[] = reviewTimeline.map(
  (entry, index) => ({
    ...entry,
    actionName: incompatibleRows[index % 6],
    labels: [
      { group: '結果', name: index % 2 ? '成功' : '継続' },
      { group: 'エリア', name: index % 2 ? '中央' : 'サイド' },
    ],
  }),
);

export const reviewWidgets = createTemplateDashboardWidgets().filter((widget) =>
  [
    'template-possession',
    'template-スクラム-result-team1',
    'template-ラインアウト-result-team2',
  ].includes(widget.id),
);
