import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { PackageDatas } from '../../../../../renderer';
import { MetaData } from '../../../../../types/MetaData';
import { VideoSyncData } from '../../../../../types/VideoSync';
import { useNotification } from '../../../../../contexts/NotificationContext';
import {
  PackageLoadResult,
  SyncStatus,
  WizardFormState,
  WizardSelectionState,
} from './types';

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

const INITIAL_SELECTION: WizardSelectionState = {
  selectedDirectory: '',
  selectedTightVideo: '',
  selectedWideVideo: '',
};

export const CreatePackageWizard: React.FC<CreatePackageWizardProps> = ({
  open,
  onClose,
  onPackageCreated,
  performAudioSync,
  syncStatus,
}) => {
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM);
  const [selection, setSelection] =
    useState<WizardSelectionState>(INITIAL_SELECTION);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Partial<WizardFormState>>({});
  const { error: showError } = useNotification();

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setSelection(INITIAL_SELECTION);
      setActiveStep(0);
      setErrors({});
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

  const handleSelectVideo = useCallback(
    async (type: 'tight' | 'wide') => {
      if (!globalThis.window.electronAPI) {
        showError('この機能はElectronアプリケーション内でのみ利用できます。');
        return;
      }
      const path = await globalThis.window.electronAPI?.openFile();
      if (path) {
        setSelection((prev) =>
          type === 'tight'
            ? { ...prev, selectedTightVideo: path }
            : { ...prev, selectedWideVideo: path },
        );
      }
    },
    [showError],
  );

  const executeCreatePackage = useCallback(async () => {
    if (!globalThis.window.electronAPI) {
      showError('この機能はElectronアプリケーション内でのみ利用できます。');
      return;
    }

    const metaDataConfig: MetaData = {
      tightViewPath: selection.selectedTightVideo,
      wideViewPath: selection.selectedWideVideo || null,
      team1Name: form.team1Name,
      team2Name: form.team2Name,
      actionList: [
        'ポゼッション',
        'スクラム',
        'ラインアウト',
        'キック',
        'タックル',
        'PK',
        'FK',
        'Check',
        'キックオフ',
        'トライ',
        'ショット',
      ],
    };

    try {
      const packageDatas: PackageDatas =
        await globalThis.window.electronAPI?.createPackage(
          selection.selectedDirectory,
          form.packageName,
          selection.selectedTightVideo,
          selection.selectedWideVideo || null,
          metaDataConfig,
        );

      if (!packageDatas) {
        throw new Error('Failed to create package');
      }

      // 新規パッケージ作成時は自動音声同期を実行しない
      // ユーザーが必要に応じてメニューから「音声同期を再実行」を選択できる
      const syncData: VideoSyncData | undefined = undefined;
      const videoList = packageDatas.wideViewPath
        ? [packageDatas.tightViewPath, packageDatas.wideViewPath]
        : [packageDatas.tightViewPath];

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
      if (!selection.selectedTightVideo) {
        showError('寄り映像を選択してください');
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
            <Chip label={form.team1Name} color="error" size="small" />
            <Typography variant="body2">vs</Typography>
            <Chip label={form.team2Name} color="primary" size="small" />
          </Stack>
        ),
      },
      { label: '保存先', value: selection.selectedDirectory },
      {
        label: '映像ファイル',
        value: (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              寄り: {selection.selectedTightVideo?.split('/').pop()}
            </Typography>
            {selection.selectedWideVideo && (
              <Typography variant="body2">
                引き: {selection.selectedWideVideo.split('/').pop()}
              </Typography>
            )}
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
          <Stack spacing={3}>
            <Alert severity="info">
              <AlertTitle>パッケージの基本情報を入力してください</AlertTitle>
              パッケージ名と対戦する2チームの名前を入力します
            </Alert>

            <TextField
              fullWidth
              label="パッケージ名"
              value={form.packageName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  packageName: event.target.value,
                }))
              }
              error={!!errors.packageName}
              helperText={errors.packageName || '例: 2024_春季大会_決勝'}
              required
            />

            <TextField
              fullWidth
              label="チーム名 (1)"
              value={form.team1Name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, team1Name: event.target.value }))
              }
              error={!!errors.team1Name}
              helperText={errors.team1Name || '赤色で表示されます'}
              required
            />

            <TextField
              fullWidth
              label="チーム名 (2)"
              value={form.team2Name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, team2Name: event.target.value }))
              }
              error={!!errors.team2Name}
              helperText={errors.team2Name || '青色で表示されます'}
              required
            />
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={3}>
            <Alert severity="info">
              <AlertTitle>パッケージの保存先を選択してください</AlertTitle>
              選択したフォルダ内に「{form.packageName || 'パッケージ'}
              」フォルダが作成されます
            </Alert>
            {selection.selectedDirectory ? (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.light' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircleIcon color="success" />
                  <Typography variant="body2" noWrap>
                    {selection.selectedDirectory}
                  </Typography>
                </Stack>
              </Paper>
            ) : (
              <Typography color="text.secondary">
                「次へ」をクリックして保存先を選択してください
              </Typography>
            )}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={3}>
            <Alert severity="info">
              <AlertTitle>映像ファイルを選択してください</AlertTitle>
              寄り映像は必須、引き映像は任意です
            </Alert>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                寄り映像 (必須)
              </Typography>
              <Button
                variant="outlined"
                onClick={() => handleSelectVideo('tight')}
                fullWidth
                sx={{ mb: 1 }}
                disabled={isAnalyzing}
              >
                {selection.selectedTightVideo ? '再選択' : '選択'}
              </Button>
              {selection.selectedTightVideo && (
                <Paper
                  variant="outlined"
                  sx={{ p: 1, bgcolor: 'success.light' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="caption" noWrap>
                      {selection.selectedTightVideo.split('/').pop()}
                    </Typography>
                  </Stack>
                </Paper>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                引き映像 (任意)
              </Typography>
              <Button
                variant="outlined"
                onClick={() => handleSelectVideo('wide')}
                fullWidth
                sx={{ mb: 1 }}
                disabled={isAnalyzing}
              >
                {selection.selectedWideVideo ? '再選択' : '選択'}
              </Button>
              {selection.selectedWideVideo && (
                <Paper
                  variant="outlined"
                  sx={{ p: 1, bgcolor: 'success.light' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="caption" noWrap>
                      {selection.selectedWideVideo.split('/').pop()}
                    </Typography>
                  </Stack>
                </Paper>
              )}
            </Box>
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2}>
            <Alert severity="success">
              <AlertTitle>作成内容の確認</AlertTitle>
              以下の内容でパッケージを作成します
            </Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                {summaryItems.map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" color="text.secondary">
                      {item.label}
                    </Typography>
                    {typeof item.value === 'string' ||
                    typeof item.value === 'number' ? (
                      <Typography variant="body1">{item.value}</Typography>
                    ) : (
                      item.value
                    )}
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}

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
