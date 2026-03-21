import type { TimelineData } from '../../../../../../types/TimelineData';

export type OverlaySettings = {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
};

type ExportScope = 'selected' | 'all';
type AngleOption = 'allAngles' | 'single' | 'multi';

export const normalizeVideoSource = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveMultiAngleSources = (
  videoSources: string[] | undefined,
  primarySource: string | undefined,
  secondarySource: string | undefined,
): { sourcePath?: string; sourcePath2?: string } => {
  const available = (videoSources ?? []).map(normalizeVideoSource).filter(Boolean) as string[];
  const sourcePath = normalizeVideoSource(primarySource) ?? available[0];
  const sourcePath2 = normalizeVideoSource(secondarySource);
  if (sourcePath2) {
    return { sourcePath, sourcePath2 };
  }
  return {
    sourcePath,
    sourcePath2: available.find((source) => source !== sourcePath),
  };
};

export const validateExportSources = ({
  angleOption,
  videoSources,
  selectedAngleIndex,
  resolvedMultiSources,
}: {
  angleOption: AngleOption;
  videoSources: string[] | undefined;
  selectedAngleIndex: number;
  resolvedMultiSources: { sourcePath?: string; sourcePath2?: string };
}): string | null => {
  if (
    angleOption === 'allAngles' &&
    (!videoSources || videoSources.length < 2)
  ) {
    return '全アングル書き出しには2つ以上の映像ソースが必要です';
  }
  if (angleOption === 'multi' && (!videoSources || videoSources.length < 2)) {
    return 'マルチアングル書き出しには2つ以上の映像ソースが必要です';
  }
  if (
    angleOption === 'single' &&
    (!videoSources || !videoSources[selectedAngleIndex])
  ) {
    return '選択されたアングルの映像が取得できません';
  }

  if (angleOption === 'multi') {
    const sourcePath = normalizeVideoSource(resolvedMultiSources.sourcePath);
    const sourcePath2 = normalizeVideoSource(resolvedMultiSources.sourcePath2);
    if (!sourcePath || !sourcePath2) {
      return 'マルチアングル書き出しにはメイン・サブ映像の両方が必要です';
    }
    if (sourcePath === sourcePath2) {
      return 'マルチアングル書き出しでは異なる映像ソースを選択してください';
    }
  }

  return null;
};

const buildActionIndexLookup = (timeline: TimelineData[]): Map<string, number> => {
  const ordered = [...timeline].sort((a, b) => a.startTime - b.startTime);
  const actionIndexLookup = new Map<string, number>();
  const counters: Record<string, number> = {};

  ordered.forEach((item) => {
    const count = (counters[item.actionName] || 0) + 1;
    counters[item.actionName] = count;
    actionIndexLookup.set(item.id, count);
  });

  return actionIndexLookup;
};

export const resolveExportSourceItems = ({
  timeline,
  selectedIds,
  exportScope,
}: {
  timeline: TimelineData[];
  selectedIds: string[];
  exportScope: ExportScope;
}): TimelineData[] => {
  if (exportScope !== 'selected') {
    return timeline;
  }
  return timeline.filter((item) => selectedIds.includes(item.id));
};

export const buildExportClips = ({
  timeline,
  sourceItems,
}: {
  timeline: TimelineData[];
  sourceItems: TimelineData[];
}) => {
  const actionIndexLookup = buildActionIndexLookup(timeline);
  return [...sourceItems]
    .sort((a, b) => a.startTime - b.startTime)
    .map((item) => {
      const count = actionIndexLookup.get(item.id) ?? 1;
      return {
        id: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        labels:
          item.labels?.map((label) => ({
            group: label.group || '',
            name: label.name,
          })) || undefined,
        memo: item.memo || undefined,
        actionIndex: count,
      };
    });
};

export const resolveSingleOrMultiSourcePath = ({
  angleOption,
  videoSources,
  selectedAngleIndex,
  resolvedMultiSources,
}: {
  angleOption: AngleOption;
  videoSources: string[] | undefined;
  selectedAngleIndex: number;
  resolvedMultiSources: { sourcePath?: string; sourcePath2?: string };
}): string | undefined => {
  return angleOption === 'single'
    ? videoSources?.[selectedAngleIndex]
    : normalizeVideoSource(resolvedMultiSources.sourcePath);
};
