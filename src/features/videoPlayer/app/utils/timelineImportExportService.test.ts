import { describe, expect, it } from 'vitest';
import type { TimelineData } from '../../../../types/TimelineData';
import { convertToSCTimeline } from '../../../../utils/scTimelineConverter';
import {
  buildTimelineExportPlan,
  parseTimelineImportContent,
} from './timelineImportExportService';

const sampleTimeline: TimelineData[] = [
  {
    id: 'timeline-1',
    actionName: 'Try',
    startTime: 12,
    endTime: 18,
    memo: '',
    labels: [{ name: 'Positive', group: 'Result' }],
  },
];

describe('timelineImportExportService', () => {
  it('builds an export plan for supported formats', () => {
    const plan = buildTimelineExportPlan('csv', sampleTimeline);

    expect(plan).not.toBeNull();
    expect(plan?.defaultFileName).toBe('timeline.csv');
    expect(plan?.formatLabel).toBe('CSV形式');
    expect(plan?.filters).toEqual([{ name: 'CSV形式', extensions: ['csv'] }]);
    expect(plan?.content).toContain('アクション名');
  });

  it('parses standard timeline JSON content', () => {
    const content = JSON.stringify(sampleTimeline);
    const result = parseTimelineImportContent(content);

    expect(result.timeline).toEqual(sampleTimeline);
    expect(result.message).toContain('1件');
  });

  it('falls back to SCTimeline content', () => {
    const content = JSON.stringify(convertToSCTimeline(sampleTimeline));
    const result = parseTimelineImportContent(content);

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]?.actionName).toBe('Try');
    expect(result.message).toContain('SCTimeline形式');
  });
});
