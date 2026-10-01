import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { searchTimeline } from './timelineReviewSearch';

const late: TimelineData = {
  id: 'late',
  actionName: 'Blue / Kick',
  startTime: 30,
  endTime: 35,
  memo: '終盤の幅を使った攻撃',
  labels: [{ group: '結果', name: '成功' }],
};
const early: TimelineData = {
  id: 'early',
  actionName: 'Red / Attack',
  startTime: 10,
  endTime: 14,
  memo: '',
};
describe('timeline review search', () => {
  it('finds actions, notes, label names and groups with AND terms', () => {
    for (const query of ['ＢＬＵＥ', '終盤', '結果 成功', 'blue 成功'])
      expect(searchTimeline([late, early], query)).toEqual([late]);
    expect(searchTimeline([late, early], 'blue Red')).toEqual([]);
    expect(searchTimeline([], '成功')).toEqual([]);
  });
  it('keeps the stored order and data intact while presenting chronological results', () => {
    const document = [late, early];
    expect(searchTimeline(document, '  ')).toEqual([early, late]);
    expect(document).toEqual([late, early]);
    expect(searchTimeline(document, '攻撃')[0]).toBe(late);
  });
});
