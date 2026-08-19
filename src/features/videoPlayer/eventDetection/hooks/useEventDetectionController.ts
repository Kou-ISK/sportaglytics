import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  EventDetectionModelInfo,
  EventDetectionProgress,
  EventTimelineMapping,
  RugbyEventType,
} from '../../../../types/eventDetection/core';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';
import type {
  NewTimelineData,
  TimelineData,
} from '../../../../types/timeline/core';
import type {
  EventDetectionAngleOption,
  EventDetectionDialogViewProps,
  EventDetectionSummary,
} from '../components/EventDetectionDialogView';
import { convertCandidatesToTimeline } from '../domain/candidatesToTimeline';
import {
  applyEventTimelineMappingUpdates,
  buildEventDetectionMappings,
} from '../domain/eventDetectionMappings';
import {
  cancelEventDetection,
  listEventDetectionModels,
  runEventDetection,
  subscribeEventDetectionOpenRequest,
  subscribeEventDetectionProgress,
} from '../gateway/eventDetectionGateway';

interface UseEventDetectionControllerParams {
  mediaAngles: PackageMediaAngle[];
  timeline: TimelineData[];
  maxTime: number;
  activeCodeWindow?: CodeWindowLayout;
  addTimelineDatas: (items: NewTimelineData[]) => string[];
}

interface UseEventDetectionControllerResult {
  viewProps: EventDetectionDialogViewProps;
}

const getModelKey = (model: EventDetectionModelInfo): string =>
  `${model.id}@${model.version}`;

const createRequestId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useEventDetectionController = ({
  mediaAngles,
  timeline,
  maxTime,
  activeCodeWindow,
  addTimelineDatas,
}: UseEventDetectionControllerParams): UseEventDetectionControllerResult => {
  const [open, setOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<EventDetectionModelInfo[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [mappings, setMappings] = useState<EventTimelineMapping[]>([]);
  const [progress, setProgress] = useState<EventDetectionProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EventDetectionSummary | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const cancelRequestedRef = useRef(false);

  const angleOptions = useMemo<EventDetectionAngleOption[]>(() => {
    return mediaAngles
      .map((angle) => ({
        id: angle.id,
        name: angle.name,
        localClipCount: angle.clips.filter(
          (clip) => clip.sourceKind === 'local' && clip.source.length > 0,
        ).length,
      }))
      .filter((angle) => angle.localClipCount > 0);
  }, [mediaAngles]);

  const selectedModel = useMemo(
    () => models.find((model) => getModelKey(model) === selectedModelKey),
    [models, selectedModelKey],
  );

  useEffect(() => {
    return subscribeEventDetectionOpenRequest(() => {
      setOpen(true);
      setError(null);
      setSummary(null);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingModels(true);
    void listEventDetectionModels()
      .then((availableModels) => {
        if (!active) return;
        setModels(availableModels);
        const firstModel = availableModels[0];
        if (firstModel) {
          setSelectedModelKey(getModelKey(firstModel));
          setMappings(buildEventDetectionMappings(firstModel, activeCodeWindow));
        } else {
          setSelectedModelKey('');
          setMappings([]);
        }
        setSelectedAngleId((current) =>
          angleOptions.some((angle) => angle.id === current)
            ? current
            : (angleOptions[0]?.id ?? ''),
        );
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setModels([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : '検出モデルの読み込みに失敗しました。',
        );
      })
      .finally(() => {
        if (active) setLoadingModels(false);
      });
    return () => {
      active = false;
    };
  }, [activeCodeWindow, angleOptions, open]);

  useEffect(() => {
    return subscribeEventDetectionProgress((nextProgress) => {
      if (nextProgress.requestId === activeRequestIdRef.current) {
        setProgress(nextProgress);
      }
    });
  }, []);

  const handleModelChange = useCallback(
    (modelKey: string): void => {
      if (running) return;
      setSelectedModelKey(modelKey);
      const model = models.find((candidate) => getModelKey(candidate) === modelKey);
      setMappings(
        model ? buildEventDetectionMappings(model, activeCodeWindow) : [],
      );
      setSummary(null);
      setError(null);
    },
    [activeCodeWindow, models, running],
  );

  const handleMappingChange = useCallback(
    (
      eventType: RugbyEventType,
      updates: Partial<EventTimelineMapping>,
    ): void => {
      if (running) return;
      setMappings((current) =>
        current.map((mapping) =>
          mapping.eventType === eventType
            ? applyEventTimelineMappingUpdates(mapping, updates)
            : mapping,
        ),
      );
    },
    [running],
  );

  const handleRun = useCallback((): void => {
    if (running || !selectedModel) return;
    const angle = mediaAngles.find((candidate) => candidate.id === selectedAngleId);
    if (!angle) {
      setError('解析するアングルを選択してください。');
      return;
    }
    const clips = angle.clips
      .filter((clip) => clip.sourceKind === 'local' && clip.source.length > 0)
      .map((clip) => ({
        clipId: clip.id,
        videoPath: clip.source,
        timelineStartSeconds: clip.timelineStartSeconds,
        ...(typeof clip.durationSeconds === 'number'
          ? { durationSeconds: clip.durationSeconds }
          : {}),
      }));
    if (clips.length === 0) {
      setError('ローカル映像クリップがありません。');
      return;
    }

    const enabledMappings = mappings.filter(
      (mapping) => mapping.enabled && mapping.actionName.trim().length > 0,
    );
    if (enabledMappings.length === 0) {
      setError('検出するイベントを1つ以上選択してください。');
      return;
    }

    const requestId = createRequestId();
    activeRequestIdRef.current = requestId;
    cancelRequestedRef.current = false;
    setRunning(true);
    setProgress({ requestId, stage: 'preparing', progress: 0 });
    setSummary(null);
    setError(null);

    void runEventDetection({
      requestId,
      modelId: selectedModel.id,
      modelVersion: selectedModel.version,
      events: enabledMappings.map((mapping) => mapping.eventType),
      clips,
    })
      .then((result) => {
        if (cancelRequestedRef.current) return;
        const converted = convertCandidatesToTimeline({
          candidates: result.candidates,
          mappings: enabledMappings,
          existingTimeline: timeline,
          maxTime: maxTime > 0 ? maxTime : undefined,
        });
        addTimelineDatas(converted.items);
        setSummary({
          added: converted.items.length,
          duplicates: converted.skippedDuplicate,
          lowConfidence: converted.skippedLowConfidence,
          modelStatus: selectedModel.status,
        });
      })
      .catch((runError: unknown) => {
        if (cancelRequestedRef.current) return;
        setError(
          runError instanceof Error
            ? runError.message
            : '自動イベント検出に失敗しました。',
        );
      })
      .finally(() => {
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current = null;
        }
        setRunning(false);
      });
  }, [
    addTimelineDatas,
    mappings,
    maxTime,
    mediaAngles,
    running,
    selectedAngleId,
    selectedModel,
    timeline,
  ]);

  const handleCancel = useCallback((): void => {
    const requestId = activeRequestIdRef.current;
    if (!requestId) return;
    cancelRequestedRef.current = true;
    void cancelEventDetection(requestId);
  }, []);

  const handleClose = useCallback((): void => {
    if (running) return;
    setOpen(false);
    setProgress(null);
  }, [running]);

  return {
    viewProps: {
      open,
      loadingModels,
      models,
      selectedModelKey,
      angleOptions,
      selectedAngleId,
      mappings,
      progress,
      running,
      error,
      summary,
      onClose: handleClose,
      onModelChange: handleModelChange,
      onAngleChange: (angleId) => {
        if (!running) {
          setSelectedAngleId(angleId);
          setSummary(null);
          setError(null);
        }
      },
      onMappingChange: handleMappingChange,
      onRun: handleRun,
      onCancel: handleCancel,
    },
  };
};
