import type { TimelineData } from '../../types/timeline/core';
import { extractActionFromActionName } from '../../utils/labelExtractors';
import type {
  CustomChartConfig,
  CustomChartData,
  CustomChartDatumValue,
} from './customChartData.shared';
import {
  DEFAULT_HISTOGRAM_BIN_SEC,
  DEFAULT_OUTLIER_IQR,
  DEFAULT_ROLLING_WINDOW,
  DEFAULT_TIME_BUCKET_SEC,
  getDuration,
  getMetricValue,
  percentile,
  setEntryIds,
  toPositiveNumber,
  toTimeLabel,
} from './customChartData.shared';

export const buildTrendLikeData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
  mode: 'trend' | 'rolling',
): CustomChartData => {
  if (timeline.length === 0) {
    return {
      data: [],
      seriesKeys: ['value'],
      unitLabel: '件',
      calcMode: 'raw',
    };
  }
  const bucketSec = toPositiveNumber(
    config.timeBucketSec,
    DEFAULT_TIME_BUCKET_SEC,
  );
  const rollingWindow = Math.max(
    1,
    Math.round(toPositiveNumber(config.rollingWindow, DEFAULT_ROLLING_WINDOW)),
  );
  const minStart = Math.min(...timeline.map((item) => item.startTime));
  const maxEnd = Math.max(...timeline.map((item) => item.endTime));
  const baseStart = Math.floor(minStart / bucketSec) * bucketSec;
  const bucketCount = Math.max(
    1,
    Math.ceil((maxEnd - baseStart + 0.0001) / bucketSec),
  );

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    start: baseStart + index * bucketSec,
    end: baseStart + (index + 1) * bucketSec,
    value: 0,
    entryIds: new Set<string>(),
  }));

  timeline.forEach((item) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((item.startTime - baseStart) / bucketSec)),
    );
    const bucket = buckets[bucketIndex];
    bucket.value += getMetricValue(item, config.metric);
    bucket.entryIds.add(item.id);
  });

  const data = buckets.map((bucket, index) => {
    let value = bucket.value;
    let entryIds = Array.from(bucket.entryIds);
    if (mode === 'rolling') {
      const windowStart = Math.max(0, index - rollingWindow + 1);
      const windowBuckets = buckets.slice(windowStart, index + 1);
      const windowTotal = windowBuckets.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      value = windowTotal / windowBuckets.length;
      const ids = new Set<string>();
      windowBuckets.forEach((item) => {
        item.entryIds.forEach((id) => ids.add(id));
      });
      entryIds = Array.from(ids);
    }
    const row: Record<string, CustomChartDatumValue> = {
      name: `${toTimeLabel(bucket.start)}-${toTimeLabel(bucket.end)}`,
      value,
    };
    setEntryIds(row, 'value', entryIds);
    return row;
  });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: config.metric === 'duration' ? '秒' : '件',
    calcMode: 'raw',
  };
};

export const buildHistogramData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
): CustomChartData => {
  if (timeline.length === 0) {
    return {
      data: [],
      seriesKeys: ['value'],
      unitLabel: '件',
      calcMode: 'raw',
    };
  }
  const binSec = toPositiveNumber(
    config.histogramBinSec,
    DEFAULT_HISTOGRAM_BIN_SEC,
  );
  const bins = new Map<
    number,
    { value: number; entryIds: Set<string>; rawCount: number }
  >();

  timeline.forEach((item) => {
    const duration = getDuration(item);
    const binStart = Math.floor(duration / binSec) * binSec;
    const bucket = bins.get(binStart) ?? {
      value: 0,
      entryIds: new Set<string>(),
      rawCount: 0,
    };
    bucket.value += getMetricValue(item, config.metric);
    bucket.rawCount += 1;
    bucket.entryIds.add(item.id);
    bins.set(binStart, bucket);
  });

  const data = Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([binStart, bucket]) => {
      const row: Record<string, CustomChartDatumValue> = {
        name: `${binStart.toFixed(1)}-${(binStart + binSec).toFixed(1)}秒`,
        value: bucket.value,
        rawValue: bucket.rawCount,
      };
      setEntryIds(row, 'value', Array.from(bucket.entryIds));
      return row;
    });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: config.metric === 'duration' ? '秒' : '件',
    calcMode: 'raw',
  };
};

export const buildOutlierData = (
  timeline: TimelineData[],
  config: CustomChartConfig,
): CustomChartData => {
  if (timeline.length === 0) {
    return {
      data: [],
      seriesKeys: ['value'],
      unitLabel: '秒',
      calcMode: 'raw',
    };
  }
  const multiplier = toPositiveNumber(
    config.outlierIqrMultiplier,
    DEFAULT_OUTLIER_IQR,
  );
  const durations = timeline
    .map((item) => getDuration(item))
    .sort((a, b) => a - b);
  const q1 = percentile(durations, 0.25);
  const q3 = percentile(durations, 0.75);
  const iqr = q3 - q1;
  const threshold = q3 + iqr * multiplier;
  const maxRows = Math.max(1, Math.round(toPositiveNumber(config.limit, 20)));

  const outliers = timeline
    .map((item) => ({
      item,
      duration: getDuration(item),
    }))
    .filter(({ duration }) => duration > threshold)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, maxRows);

  const data = outliers.map(({ item, duration }, index) => {
    const action = extractActionFromActionName(item.actionName);
    const row: Record<string, CustomChartDatumValue> = {
      name: `${index + 1}. ${action} @ ${toTimeLabel(item.startTime)}`,
      value: duration,
      rawValue: duration,
    };
    setEntryIds(row, 'value', [item.id]);
    return row;
  });

  return {
    data,
    seriesKeys: ['value'],
    unitLabel: '秒',
    calcMode: 'raw',
  };
};
