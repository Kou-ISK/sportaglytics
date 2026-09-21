import type { ClipExportAngleOption } from './clipExportTypes';
import type {
  ClipExportExecutor,
  ClipExportItem,
  ClipExportPayload,
  ClipExportMode,
  ClipExportOverlaySettings,
  ClipExportProgressState,
  ClipExportSourceSelection,
} from './clipExportTypes';

interface ClipExportSourceValidationParams {
  angleOption: ClipExportAngleOption;
  videoSources?: string[];
  selectedAngleIndex: number;
  resolvedSources: ClipExportSourceSelection;
}

interface ExecuteClipExportOptions {
  progressId?: string;
  executeExport: ClipExportExecutor;
  clips: ClipExportItem[];
  videoSources?: string[];
  angleOption: ClipExportAngleOption;
  selectedAngleIndex: number;
  resolvedSources: ClipExportSourceSelection;
  exportMode: ClipExportMode;
  exportFileName: string;
  overlay: ClipExportOverlaySettings;
  successMessage: string;
  buildAllAnglesSuccessMessage?: (count: number) => string;
  onProgress?: (progress: ClipExportProgressState | null) => void;
}

interface ClipExportActionResult {
  success: boolean;
  message: string;
}

const DEFAULT_ALL_ANGLES_SUCCESS_MESSAGE = (count: number): string => {
  return `全${count}アングルの書き出しが完了しました`;
};

const getAvailableVideoSources = (videoSources?: string[]): string[] => {
  return (videoSources ?? [])
    .map(normalizeClipExportSource)
    .filter((source): source is string => typeof source === 'string');
};

export const normalizeClipExportSource = (
  value: string | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveClipExportSourceSelection = (
  videoSources?: string[],
  primarySource?: string,
  secondarySource?: string,
): ClipExportSourceSelection => {
  const available = getAvailableVideoSources(videoSources);
  const sourcePath = normalizeClipExportSource(primarySource) ?? available[0];
  const selectedSecondary = normalizeClipExportSource(secondarySource);

  if (selectedSecondary) {
    return {
      sourcePath,
      sourcePath2: selectedSecondary,
    };
  }

  return {
    sourcePath,
    sourcePath2: available.find((source) => source !== sourcePath),
  };
};

export const validateClipExportSources = ({
  angleOption,
  videoSources,
  selectedAngleIndex,
  resolvedSources,
}: ClipExportSourceValidationParams): string | null => {
  const availableSources = getAvailableVideoSources(videoSources);

  if (angleOption === 'allAngles' && availableSources.length < 2) {
    return '全アングル書き出しには2つ以上の映像ソースが必要です';
  }

  if (angleOption === 'multi' && availableSources.length < 2) {
    return 'マルチアングル書き出しには2つ以上の映像ソースが必要です';
  }

  if (
    angleOption === 'single' &&
    !normalizeClipExportSource(videoSources?.[selectedAngleIndex])
  ) {
    return '選択されたアングルの映像が取得できません';
  }

  if (angleOption === 'multi') {
    const sourcePath = normalizeClipExportSource(resolvedSources.sourcePath);
    const sourcePath2 = normalizeClipExportSource(resolvedSources.sourcePath2);
    if (!sourcePath || !sourcePath2) {
      return 'マルチアングル書き出しにはメイン・サブ映像の両方が必要です';
    }
    if (sourcePath === sourcePath2) {
      return 'マルチアングル書き出しでは異なる映像ソースを選択してください';
    }
  }

  return null;
};

export const resolveClipExportPrimarySource = ({
  angleOption,
  videoSources,
  selectedAngleIndex,
  resolvedSources,
}: ClipExportSourceValidationParams): string | undefined => {
  if (angleOption === 'single') {
    return normalizeClipExportSource(videoSources?.[selectedAngleIndex]);
  }

  return normalizeClipExportSource(resolvedSources.sourcePath);
};

const buildExportFileName = (
  exportFileName: string,
  suffix?: string,
): string | undefined => {
  const baseName = exportFileName.trim();
  if (!baseName) {
    return undefined;
  }

  return suffix ? `${baseName}_${suffix}` : baseName;
};

// Playlist clips carry their own sources (possibly from different packages).
// A chosen angle must apply to every clip, not just the fallback source.
const selectClipAngle = (
  clips: ClipExportItem[],
  index: number,
): ClipExportItem[] =>
  clips.map((clip) => {
    if (!('videoSource' in clip) && !('videoSource2' in clip)) return clip;
    if (index === 0 && clip.videoSource)
      return { ...clip, angleType: 'angle1' };
    if (index === 1 && clip.videoSource2)
      return { ...clip, angleType: 'angle2' };
    throw new Error(
      '選択したアングルがないクリップがあります。各クリップの映像ソースを確認してください。',
    );
  });

export const buildClipExportRequests = ({
  progressId,
  clips,
  videoSources,
  angleOption,
  selectedAngleIndex,
  resolvedSources,
  exportMode,
  exportFileName,
  overlay,
}: Pick<
  ExecuteClipExportOptions,
  | 'progressId'
  | 'clips'
  | 'videoSources'
  | 'angleOption'
  | 'selectedAngleIndex'
  | 'resolvedSources'
  | 'exportMode'
  | 'exportFileName'
  | 'overlay'
>): ClipExportPayload[] => {
  if (angleOption === 'defaultAngles') {
    if (!clips.length) throw new Error('書き出すクリップがありません');
    for (const clip of clips) {
      const source =
        clip.angleType === 'angle2' ? clip.videoSource2 : clip.videoSource;
      if (!source)
        throw new Error(
          '既定アングルの映像がないクリップがあります。参照先を再接続してください。',
        );
    }
    return [
      {
        progressId,
        sourcePath: clips[0].videoSource || clips[0].videoSource2 || '',
        mode: 'single',
        exportMode,
        angleOption: 'single',
        outputFileName: buildExportFileName(exportFileName),
        clips,
        overlay,
      },
    ];
  }
  if (angleOption === 'multi') selectClipAngle(clips, 1);
  if (angleOption === 'allAngles')
    return getAvailableVideoSources(videoSources).map((sourcePath, index) => ({
      sourcePath,
      progressId,
      mode: 'single',
      exportMode,
      angleOption: 'single',
      outputFileName: buildExportFileName(exportFileName, `angle${index + 1}`),
      clips: selectClipAngle(clips, index),
      overlay,
    }));
  const sourcePath = resolveClipExportPrimarySource({
    angleOption,
    videoSources,
    selectedAngleIndex,
    resolvedSources,
  });
  if (!sourcePath) throw new Error('書き出し対象の映像ソースが見つかりません');
  return [
    {
      sourcePath,
      progressId,
      sourcePath2:
        angleOption === 'multi'
          ? normalizeClipExportSource(resolvedSources.sourcePath2)
          : undefined,
      mode: angleOption === 'multi' ? 'dual' : 'single',
      exportMode,
      angleOption,
      outputFileName: buildExportFileName(exportFileName),
      clips:
        angleOption === 'single'
          ? selectClipAngle(clips, selectedAngleIndex)
          : clips.map(({ angleType: _angle, ...clip }) => clip),
      overlay,
    },
  ];
};

export const executeClipExport = async (
  options: ExecuteClipExportOptions,
): Promise<ClipExportActionResult> => {
  const {
    executeExport,
    angleOption,
    onProgress,
    successMessage,
    buildAllAnglesSuccessMessage = DEFAULT_ALL_ANGLES_SUCCESS_MESSAGE,
  } = options;
  try {
    const requests = buildClipExportRequests(options);
    for (const [index, request] of requests.entries()) {
      onProgress?.(
        angleOption === 'allAngles'
          ? {
              current: index + 1,
              total: requests.length,
              message: `アングル${index + 1} / ${requests.length} を書き出し中...`,
            }
          : { current: 0, total: 1, message: '書き出し中...' },
      );
      const result = await executeExport(request);
      if (!result.success)
        return {
          success: false,
          message: result.error || '書き出しに失敗しました',
        };
    }
    return {
      success: true,
      message:
        angleOption === 'allAngles'
          ? buildAllAnglesSuccessMessage(requests.length)
          : successMessage,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : '書き出しに失敗しました',
    };
  } finally {
    onProgress?.(null);
  }
};
