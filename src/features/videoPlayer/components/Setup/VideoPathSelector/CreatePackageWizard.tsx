import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { PackageDatas } from '../../../../../renderer';
import { MetaData } from '../../../../../types/MetaData';
import { VideoSyncData } from '../../../../../types/VideoSync';
import { useNotification } from '../../../../../contexts/NotificationContext';
import { ActionList } from '../../../../../ActionList';
import {
  PackageLoadResult,
  SyncStatus,
  WizardFormState,
  WizardSelectionState,
} from './types';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { DirectoryStep } from './steps/DirectoryStep';
import { VideoSelectionStep } from './steps/VideoSelectionStep';
import { SummaryStep } from './steps/SummaryStep';

interface CreatePackageWizardProps {
  open: boolean;
  onClose: () => void;
  onPackageCreated: (payload: PackageLoadResult) => void;
  performAudioSync: (
    tightPath: string,
    widePath: string,
  ) => Promise<VideoSyncData>;
  syncStatus: SyncStatus;
}

const STEPS = ['基本情報', '保存先選択', '映像ファイル選択', '確認'];

const INITIAL_FORM: WizardFormState = {
  packageName: '',
  team1Name: '',
  team2Name: '',
};

const createAngleId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `angle-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const createInitialSelection = (): WizardSelectionState => {
  const firstAngleId = createAngleId();
  return {
    selectedDirectory: '',
    angles: [
      {
        id: firstAngleId,
        name: 'Angle 1',
        filePath: '',
      },
    ],
  };
};

export const CreatePackageWizard: React.FC<CreatePackageWizardProps> = ({
  open,
  onClose,
  onPackageCreated,
  performAudioSync,
  syncStatus,
}) => {
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM);
  const [selection, setSelection] = useState<WizardSelectionState>(
    createInitialSelection(),
  );
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Partial<WizardFormState>>({});
  const { error: showError } = useNotification();
  const [hasPromptedDirectory, setHasPromptedDirectory] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setSelection(createInitialSelection());
      setActiveStep(0);
      setErrors({});
      setHasPromptedDirectory(false);
    }
  }, [open]);

  const isAnalyzing = syncStatus.isAnalyzing;

  const validateStep = useCallback(
    (step: number) => {
      const nextErrors: Partial<WizardFormState> = {};
      if (step === 0) {
        if (!form.packageName.trim()) {
          nextErrors.packageName = 'パッケージ名を入力してください';
        }
        if (!form.team1Name.trim()) {
          nextErrors.team1Name = 'チーム名(1)を入力してください';
        }
        if (!form.team2Name.trim()) {
          nextErrors.team2Name = 'チーム名(2)を入力してください';
        }
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [form],
  );

  const handleSelectDirectory = useCallback(async () => {
    if (!globalThis.window.electronAPI) {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
      return;
    }
    const directory = await globalThis.window.electronAPI?.openDirectory();
    if (directory) {
      setSelection((prev) => ({ ...prev, selectedDirectory: directory }));
    }
  }, [showError]);

  useEffect(() => {
    if (activeStep === 1 && !selection.selectedDirectory && !hasPromptedDirectory) {
      setHasPromptedDirectory(true);
      void handleSelectDirectory();
    }
  }, [activeStep, handleSelectDirectory, hasPromptedDirectory, selection.selectedDirectory]);

  const handleSelectVideo = useCallback(
    async (angleId: string) => {
      if (!globalThis.window.electronAPI) {
        showError('この機能はElectronアプリケーション内でのみ利用できます。');
        return;
      }
      const path = await globalThis.window.electronAPI?.openFile();
      if (path) {
        setSelection((prev) => ({
          ...prev,
          angles: prev.angles.map((angle) =>
            angle.id === angleId ? { ...angle, filePath: path } : angle,
          ),
        }));
      }
    },
    [showError],
  );

  const handleAddAngle = useCallback(() => {
    setSelection((prev) => {
      const newAngleId = createAngleId();
      const nextIndex = prev.angles.length + 1;
      return {
        ...prev,
        angles: [
          ...prev.angles,
          {
            id: newAngleId,
            name: `Angle ${nextIndex}`,
            filePath: '',
          },
        ],
      };
    });
  }, []);

  const handleRemoveAngle = useCallback((angleId: string) => {
    setSelection((prev) => {
      if (prev.angles.length === 1) return prev;
      const filtered = prev.angles.filter((angle) => angle.id !== angleId);
      return {
        ...prev,
        angles: filtered,
      };
    });
  }, []);
  const handleUpdateAngleName = useCallback((angleId: string, name: string) => {
    setSelection((prev) => ({
      ...prev,
      angles: prev.angles.map((angle) =>
        angle.id === angleId ? { ...angle, name } : angle,
      ),
    }));
  }, []);

  const executeCreatePackage = useCallback(async () => {
    if (!globalThis.window.electronAPI) {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
      return;
    }

    const anglePayloads: Array<{
      id: string;
      name: string;
      sourcePath: string;
      role?: 'primary' | 'secondary';
    }> = selection.angles
      .filter((angle) => angle.filePath)
      .map((angle, index) => {
        const role: 'primary' | 'secondary' | undefined =
          index === 0 ? 'primary' : index === 1 ? 'secondary' : undefined;
        return {
          id: angle.id,
          name: angle.name.trim() || 'Angle',
          sourcePath: angle.filePath,
          role,
        };
      });

    if (!anglePayloads.length) {
      showError('少なくとも1つのアングルに映像を割り当ててください。');
      return;
    }

    const metaDataConfig: MetaData = {
      tightViewPath: '',
      wideViewPath: null,
      team1Name: form.team1Name,
      team2Name: form.team2Name,
      actionList: ActionList.map((item) => item.action),
      primaryAngleId: anglePayloads[0]?.id || undefined,
      secondaryAngleId: anglePayloads[1]?.id || undefined,
      angles: undefined,
    };

    try {
      const packageDatas: PackageDatas =
        await globalThis.window.electronAPI?.createPackage(
          selection.selectedDirectory,
          form.packageName,
          anglePayloads,
          metaDataConfig,
        );

      if (!packageDatas) {
        throw new Error('Failed to create package');
      }

      // 新規パッケージ作成時は自動音声同期を実行しない
      // ユーザーが必要に応じてメニューから「音声同期を再実行」を選択できる
      const syncData: VideoSyncData | undefined = undefined;
      const primaryAngle = packageDatas.angles[0];
      const secondaryAngle =
        packageDatas.angles.length > 1 ? packageDatas.angles[1] : undefined;
      const videoList = [
        primaryAngle?.absolutePath,
        secondaryAngle?.absolutePath,
      ].filter(Boolean) as string[];

      onPackageCreated({
        videoList,
        syncData,
        timelinePath: packageDatas.timelinePath,
        metaDataConfigFilePath: packageDatas.metaDataConfigFilePath,
        packagePath: `${selection.selectedDirectory}/${form.packageName}`,
      });
      onClose();
    } catch (error) {
      console.error('パッケージ作成に失敗しました:', error);
      showError('パッケージの作成中にエラーが発生しました。');
    }
  }, [
    form.packageName,
    form.team1Name,
    form.team2Name,
    onClose,
    onPackageCreated,
    performAudioSync,
    selection,
    showError,
  ]);

  const handleNext = useCallback(async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    if (activeStep === 1) {
      if (!selection.selectedDirectory) {
        await handleSelectDirectory();
        return;
      }
    }

    if (activeStep === 2) {
      const primaryAngle = selection.angles[0];
      if (!primaryAngle?.filePath) {
        showError('メインアングルに映像を割り当ててください。');
        return;
      }

      if (!selection.angles.some((angle) => angle.filePath)) {
        showError('少なくとも1つのアングルに映像を割り当ててください。');
        return;
      }
    }

    if (activeStep === STEPS.length - 1) {
      await executeCreatePackage();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  }, [
    activeStep,
    handleSelectDirectory,
    selection,
    validateStep,
    showError,
    executeCreatePackage,
  ]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(0, prev - 1));
  }, []);

  const summaryItems = useMemo(
    () => [
      { label: 'パッケージ名', value: form.packageName },
      {
        label: 'チーム',
        value: (
          <Stack direction="row" spacing={1}>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                fontSize: '0.75rem',
              }}
            >
              {form.team1Name}
            </Box>
            <Typography variant="body2">vs</Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                fontSize: '0.75rem',
              }}
            >
              {form.team2Name}
            </Box>
          </Stack>
        ),
      },
      { label: '保存先', value: selection.selectedDirectory },
      {
        label: 'アングル設定',
        value: (
          <Stack spacing={1}>
            {selection.angles.map((angle, index) => {
              const fileName = angle.filePath
                ? angle.filePath.split('/').pop()
                : '未選択';
              const roleLabel =
                index === 0
                  ? 'メイン (自動)'
                  : index === 1
                    ? 'セカンダリ (自動)'
                    : '';
              return (
                <Stack key={angle.id} direction="row" spacing={1}>
                  <Typography variant="body2" sx={{ minWidth: 110 }}>
                    {angle.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fileName}
                  </Typography>
                  {roleLabel && (
                    <Box
                      component="span"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor:
                          roleLabel.includes('メイン')
                            ? 'primary.main'
                            : 'info.main',
                        color: 'primary.contrastText',
                        fontSize: '0.75rem',
                      }}
                    >
                      {roleLabel}
                    </Box>
                  )}
                </Stack>
              );
            })}
          </Stack>
        ),
      },
    ],
    [form.packageName, form.team1Name, form.team2Name, selection],
  );

  if (!open) {
    return null;
  }

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'auto',
          p: 4,
          zIndex: 1300,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <VideoFileIcon color="primary" />
          <Typography variant="h5">新規パッケージ作成</Typography>
        </Stack>

        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <BasicInfoStep
            form={form}
            errors={errors}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
          />
        )}

        {activeStep === 1 && (
          <DirectoryStep
            packageName={form.packageName}
            selectedDirectory={selection.selectedDirectory}
            onSelectDirectory={handleSelectDirectory}
          />
        )}

        {activeStep === 2 && (
          <VideoSelectionStep
            isAnalyzing={isAnalyzing}
            angles={selection.angles}
            onSelectVideo={handleSelectVideo}
            onAddAngle={handleAddAngle}
            onRemoveAngle={handleRemoveAngle}
            onUpdateAngleName={handleUpdateAngleName}
          />
        )}

        {activeStep === 3 && <SummaryStep items={summaryItems} />}

        {syncStatus.isAnalyzing && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  音声同期分析中...
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {syncStatus.syncStage}
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={syncStatus.syncProgress}
              sx={{ mt: 1 }}
            />
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button onClick={onClose} disabled={isAnalyzing}>
            キャンセル
          </Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && (
            <Button onClick={handleBack} disabled={isAnalyzing}>
              戻る
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isAnalyzing}
          >
            {activeStep === STEPS.length - 1 ? '作成' : '次へ'}
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1299,
        }}
        onClick={onClose}
      />
    </>
  );
};
