import type { TimelineData } from '../types/timeline/core';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelsFromTimelineData,
} from './labelExtractors';

const toCsvCell = (value: string | number) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

const formatSeconds = (seconds: number, digits = 1) => {
  if (!Number.isFinite(seconds)) return '0.0';
  return Math.max(0, seconds).toFixed(digits);
};

const formatTimecode = (seconds: number): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(3, '0')}`;
};

const joinValues = (values: Iterable<string>): string =>
  Array.from(values).filter(Boolean).join(' | ');

const collectLabelGroups = (timeline: TimelineData[]): string[] => {
  const groups = new Set<string>();
  timeline.forEach((entry) => {
    getLabelsFromTimelineData(entry).forEach((label) => {
      if (label.group) {
        groups.add(label.group);
      }
    });
  });

  const fixed = ['actionType', 'actionResult'];
  const extras = Array.from(groups)
    .filter((group) => !fixed.includes(group))
    .sort((a, b) => a.localeCompare(b));
  return [...fixed, ...extras];
};

export const exportRawAnalysisCsv = (timeline: TimelineData[]): string => {
  const labelGroups = collectLabelGroups(timeline);
  const headers = [
    'index',
    'id',
    'startSec',
    'endSec',
    'durationSec',
    'startTimecode',
    'endTimecode',
    'team',
    'action',
    'actionName',
    'memo',
    'color',
    'labelCount',
    'labels',
    ...labelGroups.map((group) => `label:${group}`),
  ];

  const rows: string[] = [headers.map(toCsvCell).join(',')];

  timeline.forEach((entry, index) => {
    const duration = Math.max(0, entry.endTime - entry.startTime);
    const labels = getLabelsFromTimelineData(entry);
    const labelByGroup = new Map<string, Set<string>>();

    labels.forEach((label) => {
      if (!label.group || !label.name) return;
      const bucket = labelByGroup.get(label.group) ?? new Set<string>();
      bucket.add(label.name);
      labelByGroup.set(label.group, bucket);
    });

    const labelText = labels
      .map((label) =>
        label.group ? `${label.group}:${label.name}` : (label.name ?? ''),
      )
      .filter(Boolean)
      .join(' | ');

    const row = [
      index + 1,
      entry.id,
      formatSeconds(entry.startTime, 3),
      formatSeconds(entry.endTime, 3),
      formatSeconds(duration, 3),
      formatTimecode(entry.startTime),
      formatTimecode(entry.endTime),
      extractTeamFromActionName(entry.actionName),
      extractActionFromActionName(entry.actionName),
      entry.actionName,
      entry.memo ?? '',
      entry.color ?? '',
      labels.length,
      labelText,
      ...labelGroups.map((group) => joinValues(labelByGroup.get(group) ?? [])),
    ];

    rows.push(row.map(toCsvCell).join(','));
  });

  return rows.join('\n');
};
