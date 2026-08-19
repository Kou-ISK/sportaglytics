import type {
  EventDetectionModelInfo,
  EventTimelineMapping,
  RugbyEventType,
} from '../../../../types/eventDetection/core';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';

const EVENT_NAMES: Record<RugbyEventType, string> = {
  restart: 'リスタート',
  scrum: 'Scrum',
  lineout: 'Lineout',
  maul: 'Maul',
  goalKick: 'Goal Kick',
};

const EVENT_NAME_ALIASES: Partial<Record<RugbyEventType, readonly string[]>> = {
  restart: ['リスタート', 'Restart', 'Kickoff', 'Kick Off', 'キックオフ'],
};

const DEFAULT_RANGES: Record<
  RugbyEventType,
  { leadTimeSeconds: number; lagTimeSeconds: number }
> = {
  restart: { leadTimeSeconds: 5, lagTimeSeconds: 15 },
  scrum: { leadTimeSeconds: 5, lagTimeSeconds: 10 },
  lineout: { leadTimeSeconds: 5, lagTimeSeconds: 10 },
  maul: { leadTimeSeconds: 5, lagTimeSeconds: 10 },
  goalKick: { leadTimeSeconds: 5, lagTimeSeconds: 10 },
};

const normalizeEventName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const clampFinite = (
  value: number,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

export const normalizeConfidenceThreshold = (
  value: number,
  fallback: number,
): number => clampFinite(value, 0, 1, fallback);

export const buildEventDetectionMappings = (
  model: EventDetectionModelInfo,
  activeCodeWindow?: CodeWindowLayout,
): EventTimelineMapping[] => {
  return model.events.map((eventType) => {
    const defaultName = EVENT_NAMES[eventType];
    const aliases = EVENT_NAME_ALIASES[eventType] ?? [defaultName];
    const normalizedAliases = new Set(aliases.map(normalizeEventName));
    const configuredButton = activeCodeWindow?.buttons.find(
      (button) =>
        button.type === 'action' && normalizedAliases.has(normalizeEventName(button.name)),
    );
    const defaultRange = DEFAULT_RANGES[eventType];
    const metric = model.metrics[eventType];

    return {
      eventType,
      actionName: configuredButton?.name ?? defaultName,
      enabled: true,
      minConfidence: normalizeConfidenceThreshold(metric?.confidenceThreshold ?? 1, 1),
      leadTimeSeconds:
        configuredButton?.leadTimeSeconds ?? defaultRange.leadTimeSeconds,
      lagTimeSeconds:
        configuredButton?.lagTimeSeconds ?? defaultRange.lagTimeSeconds,
    };
  });
};

export const applyEventTimelineMappingUpdates = (
  mapping: EventTimelineMapping,
  updates: Partial<EventTimelineMapping>,
): EventTimelineMapping => {
  const next = { ...mapping, ...updates };
  return {
    ...next,
    minConfidence: normalizeConfidenceThreshold(
      next.minConfidence,
      mapping.minConfidence,
    ),
    leadTimeSeconds: clampFinite(
      next.leadTimeSeconds,
      0,
      600,
      mapping.leadTimeSeconds,
    ),
    lagTimeSeconds: clampFinite(
      next.lagTimeSeconds,
      0,
      600,
      mapping.lagTimeSeconds,
    ),
  };
};
