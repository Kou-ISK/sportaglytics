import { describe, expect, it } from 'vitest';
import { buildHierarchicalMatrix } from './matrixBuilder';
import type { TimelineData } from '../types/timeline/core';

const createTimelineItem = (
  id: string,
  actionName: string,
  labels?: TimelineData['labels'],
): TimelineData => ({
  id,
  actionName,
  startTime: 0,
  endTime: 1,
  memo: '',
  labels,
});

describe('buildHierarchicalMatrix', () => {
  it('counts entries without the selected row label under 未設定', () => {
    const timeline = [
      createTimelineItem('1', 'Team1 スクラム', [
        { group: 'results', name: 'Won' },
      ]),
      createTimelineItem('2', 'Team1 スクラム'),
    ];

    const result = buildHierarchicalMatrix(
      timeline,
      { type: 'group', value: 'results' },
      { type: 'action' },
    );

    const unsetRowIndex = result.rowHeaders.findIndex(
      (header) => header.child === '未設定',
    );
    const scrumColumnIndex = result.columnHeaders.findIndex(
      (header) => header.child === 'スクラム',
    );

    expect(unsetRowIndex).toBeGreaterThanOrEqual(0);
    expect(scrumColumnIndex).toBeGreaterThanOrEqual(0);
    expect(result.matrix[unsetRowIndex]?.[scrumColumnIndex]?.count).toBe(1);
  });

  it('counts entries without the selected column label under 未設定', () => {
    const timeline = [
      createTimelineItem('1', 'Team1 ラインアウト', [
        { group: 'types', name: 'Front' },
      ]),
      createTimelineItem('2', 'Team1 ラインアウト', []),
    ];

    const result = buildHierarchicalMatrix(
      timeline,
      { type: 'action' },
      { type: 'group', value: 'types' },
    );

    const lineoutRowIndex = result.rowHeaders.findIndex(
      (header) => header.child === 'ラインアウト',
    );
    const unsetColumnIndex = result.columnHeaders.findIndex(
      (header) => header.child === '未設定',
    );

    expect(lineoutRowIndex).toBeGreaterThanOrEqual(0);
    expect(unsetColumnIndex).toBeGreaterThanOrEqual(0);
    expect(result.matrix[lineoutRowIndex]?.[unsetColumnIndex]?.count).toBe(1);
  });
});
