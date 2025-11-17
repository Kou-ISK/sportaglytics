import React, { useCallback, useState } from 'react';
import {
  Box,
  Stack,
  Button,
  Typography,
  Grid,
  Paper,
  alpha,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import TimelineIcon from '@mui/icons-material/Timeline';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { VideoSyncData } from '../../../../types/VideoSync';
import { ExistingPackageLoader } from './VideoPathSelector/ExistingPackageLoader';
import { CreatePackageWizard } from './VideoPathSelector/CreatePackageWizard';
import { AudioSyncBackdrop } from './VideoPathSelector/AudioSyncBackdrop';
import { RecentPackageCard } from './VideoPathSelector/RecentPackageCard';
import {
  PackageLoadResult,
  VideoPathSelectorProps,
} from './VideoPathSelector/types';
import { useAudioSync } from './VideoPathSelector/hooks/useAudioSync';
import { useDragAndDrop } from './VideoPathSelector/hooks/useDragAndDrop';
import { useRecentPackages } from './VideoPathSelector/hooks/useRecentPackages';
import { useNotification } from '../../../../contexts/NotificationContext';
import { ONBOARDING_STORAGE_KEY } from '../../../../components/OnboardingTutorial';

export const VideoPathSelector: React.FC<VideoPathSelectorProps> = ({
  setVideoList,
  setIsFileSelected,
  setTimelineFilePath,
  setPackagePath,
  setMetaDataConfigFilePath,
  setSyncData,
}) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const { performAudioSync, status: syncStatus } = useAudioSync({
    setSyncData,
  });
  const { recentPackages, addRecentPackage, removeRecentPackage } =
    useRecentPackages();
  const { notify } = useNotification();

  // オンボーディング未完了時のみウェルカムヘッダーを表示
  React.useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    setShowWelcome(!completed);
  }, []);

  const handlePackageLoaded = useCallback(
    ({
      videoList,
      syncData,
      timelinePath,
      metaDataConfigFilePath,
      packagePath,
    }: PackageLoadResult) => {
      setVideoList(videoList);
      setSyncData(syncData);
      setTimelineFilePath(timelinePath);
      setMetaDataConfigFilePath(metaDataConfigFilePath);
      if (packagePath) {
        setPackagePath(packagePath);
      }
      setIsFileSelected(true);

      // 履歴に追加（metaDataからチーム名を取得）
      if (packagePath && metaDataConfigFilePath) {
        if (globalThis.window.electronAPI?.readJsonFile) {
          globalThis.window.electronAPI
            .readJsonFile(metaDataConfigFilePath)
            .then((config: unknown) => {
              const typedConfig = config as {
                team1Name?: string;
                team2Name?: string;
              };
              addRecentPackage({
                path: packagePath,
                name: packagePath.split('/').pop() || 'Unknown',
                team1Name: typedConfig.team1Name || 'Team 1',
                team2Name: typedConfig.team2Name || 'Team 2',
                videoCount: videoList.length,
              });
            })
            .catch((err) =>
              console.error('Failed to update recent packages:', err),
            );
        }
      }
    },
    [
      setIsFileSelected,
      setMetaDataConfigFilePath,
      setPackagePath,
      setSyncData,
      setTimelineFilePath,
      setVideoList,
      addRecentPackage,
    ],
  );

  const handlePackageCreated = useCallback(
    (payload: PackageLoadResult) => {
      handlePackageLoaded(payload);
      setWizardOpen(false);
      notify({ message: 'パッケージを作成しました', severity: 'success' });
    },
    [handlePackageLoaded, notify],
  );

  // ドラッグ&ドロップでパッケージを開く
  const handlePackageDrop = useCallback(
    async (packagePath: string) => {
      if (!globalThis.window.electronAPI) {
        notify({
          message: 'この機能はElectronアプリケーション内でのみ利用できます。',
          severity: 'error',
        });
        return;
      }

      const configFilePath = `${packagePath}/.metadata/config.json`;
      const exists =
        await globalThis.window.electronAPI?.checkFileExists?.(configFilePath);

      if (!exists) {
        notify({
          message:
            'パッケージフォルダ内に .metadata/config.json が見つかりません。',
          severity: 'error',
        });
        return;
      }

      try {
        if (!globalThis.window.electronAPI?.readJsonFile) {
          throw new Error('electronAPI.readJsonFile is not available');
        }
        const config =
          await globalThis.window.electronAPI.readJsonFile(configFilePath);

        const typedConfig = config as {
          tightViewPath: string;
          wideViewPath?: string;
          syncData?: VideoSyncData;
        };

        const tightRelative = typedConfig.tightViewPath;
        const wideRelative = typedConfig.wideViewPath || undefined;
        const tightAbsolute = `${packagePath}/${tightRelative}`;
        const wideAbsolute = wideRelative
          ? `${packagePath}/${wideRelative}`
          : undefined;

        const videoList = wideAbsolute
          ? [tightAbsolute, wideAbsolute]
          : [tightAbsolute];

        handlePackageLoaded({
          videoList,
          syncData: typedConfig.syncData,
          timelinePath: `${packagePath}/timeline.json`,
          metaDataConfigFilePath: configFilePath,
          packagePath,
        });

        notify({
          message: 'パッケージを開きました',
          severity: 'success',
        });
      } catch (error) {
        console.error('Failed to load dropped package:', error);
        notify({
          message: 'パッケージの読み込みに失敗しました',
          severity: 'error',
        });
      }
    },
    [handlePackageLoaded, notify],
  );

  const { dragState, handlers } = useDragAndDrop(handlePackageDrop);

  // 最近のパッケージから開く
  const handleRecentPackageOpen = useCallback(
    (path: string) => {
      handlePackageDrop(path);
    },
    [handlePackageDrop],
  );

  return (
    <Box sx={{ width: '100%', mx: 'auto', mt: 2, px: 2 }} {...handlers}>
      <Stack spacing={4}>
        {/* ウェルカムヘッダー（初回のみ表示） */}
        {showWelcome && (
          <>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography
                variant="h3"
                fontWeight="bold"
                gutterBottom
                sx={{
                  background: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(45deg, #1E90FF 30%, #00FF85 90%)'
                      : 'linear-gradient(45deg, #1E90FF 30%, #00CED1 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                SporTagLytics
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                映像分析を効率化する、プロフェッショナルなタグ付けツール
              </Typography>

              {/* クイックスタートガイド */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                justifyContent="center"
                sx={{ mt: 4, mb: 2 }}
              >
                <Box sx={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.1),
                      mb: 1,
                    }}
                  >
                    <PlayCircleOutlineIcon
                      sx={{ fontSize: 40, color: 'primary.main' }}
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    1. 映像を開く
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    パッケージを選択
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: (theme) =>
                        alpha(theme.palette.secondary.main, 0.1),
                      mb: 1,
                    }}
                  >
                    <TimelineIcon
                      sx={{ fontSize: 40, color: 'secondary.main' }}
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    2. タグ付け
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    プレーを記録
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.1),
                      mb: 1,
                    }}
                  >
                    <BarChartIcon
                      sx={{ fontSize: 40, color: 'primary.main' }}
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    3. 分析
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    統計を確認
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Divider />
          </>
        )}

        {/* ドラッグ&ドロップゾーン */}
        <Paper
          elevation={dragState.isDragging ? 8 : 2}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: (() => {
              if (!dragState.isDragging) return 'divider';
              return dragState.isValidDrop ? 'primary.main' : 'error.main';
            })(),
            bgcolor: (theme) => {
              if (!dragState.isDragging) return 'background.paper';
              const baseColor = dragState.isValidDrop
                ? theme.palette.primary.main
                : theme.palette.error.main;
              return alpha(baseColor, 0.08);
            },
            transition: 'all 0.2s ease-in-out',
            cursor: 'pointer',
          }}
        >
          <CloudUploadIcon
            sx={{
              fontSize: 64,
              color: dragState.isDragging ? 'primary.main' : 'text.secondary',
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {dragState.isDragging
              ? 'ここにドロップ'
              : 'パッケージフォルダをドラッグ&ドロップ'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            または下のボタンから選択
          </Typography>
        </Paper>

        {/* 既存のボタン */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <ExistingPackageLoader
            onPackageLoaded={handlePackageLoaded}
            performAudioSync={performAudioSync}
          />

          <Button
            sx={{ height: '60px', fontSize: '16px', flex: 1 }}
            onClick={() => setWizardOpen(true)}
            variant="outlined"
            size="large"
            startIcon={<AddIcon />}
          >
            新規パッケージを作成
          </Button>
        </Stack>

        {/* 最近使ったパッケージ */}
        {recentPackages.length > 0 && (
          <>
            <Divider sx={{ my: 2 }}>
              <Typography variant="overline" color="text.secondary">
                最近使ったパッケージ
              </Typography>
            </Divider>

            <Grid container spacing={3}>
              {recentPackages.map((pkg) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={pkg.path}>
                  <RecentPackageCard
                    package={pkg}
                    onOpen={handleRecentPackageOpen}
                    onRemove={removeRecentPackage}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Stack>

      <CreatePackageWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onPackageCreated={handlePackageCreated}
        performAudioSync={performAudioSync}
        syncStatus={syncStatus}
      />

      <AudioSyncBackdrop status={syncStatus} />
    </Box>
  );
};
