import type { ClipExportAngleOption } from './clipExportTypes';
import type {
  ClipExportExecutor,
  ClipExportItem,
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
    if (!clip.videoSource && !clip.videoSource2) return clip;
    if (index === 0) return { ...clip, angleType: 'angle1' };
    if (index === 1 && clip.videoSource2)
      return { ...clip, angleType: 'angle2' };
    throw new Error(
      '選択したアングルがないクリップがあります。各クリップの映像ソースを確認してください。',
    );
  });

export const executeClipExport = async ({
  executeExport,
  progressId,
  clips,
  videoSources,
  angleOption,
  selectedAngleIndex,
  resolvedSources,
  exportMode,
  exportFileName,
  overlay,
  successMessage,
  buildAllAnglesSuccessMessage = DEFAULT_ALL_ANGLES_SUCCESS_MESSAGE,
  onProgress,
}: ExecuteClipExportOptions): Promise<ClipExportActionResult> => {
  try {
    if (angleOption === 'multi') selectClipAngle(clips, 1);
    if (angleOption === 'allAngles') {
      const availableSources = getAvailableVideoSources(videoSources);
      const clipsByAngle = availableSources.map((_, index) =>
        selectClipAngle(clips, index),
      );
      for (let i = 0; i < availableSources.length; i += 1) {
        onProgress?.({
          current: i + 1,
          total: availableSources.length,
          message: `アングル${i + 1} / ${availableSources.length} を書き出し中...`,
        });

        const result = await executeExport({
          sourcePath: availableSources[i],
          progressId,
          sourcePath2: undefined,
          mode: 'single',
          exportMode,
          angleOption: 'single',
          outputFileName: buildExportFileName(exportFileName, `angle${i + 1}`),
          clips: clipsByAngle[i],
          overlay,
        });

        if (!result.success) {
          onProgress?.(null);
          return {
            success: false,
            message: result.error || `アングル${i + 1}の書き出しに失敗しました`,
          };
        }
      }

      onProgress?.(null);
      return {
        success: true,
        message: buildAllAnglesSuccessMessage(availableSources.length),
      };
    }

    const sourcePath = resolveClipExportPrimarySource({
      angleOption,
      videoSources,
      selectedAngleIndex,
      resolvedSources,
    });
    if (!sourcePath) {
      return {
        success: false,
        message: '書き出し対象の映像ソースが見つかりません',
      };
    }

    onProgress?.({
      current: 0,
      total: 1,
      message: '書き出し中...',
    });

    const result = await executeExport({
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
          : clips,
      overlay,
    });

    onProgress?.(null);
    if (result.success) {
      return {
        success: true,
        message: successMessage,
      };
    }

    return {
      success: false,
      message: result.error || '書き出しに失敗しました',
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
