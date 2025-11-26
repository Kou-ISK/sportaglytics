import React, { forwardRef, useImperativeHandle } from 'react';
import { Box, Typography, Grid, Button } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import videojs from 'video.js';
import { EnhancedCodeButton } from './EnhancedCodeButton';
import { useActionPreset } from '../../../../contexts/ActionPresetContext';
import type { ActionDefinition } from '../../../../types/Settings';

interface EnhancedCodePanelProps {
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    qualifier: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
  ) => void;
  teamNames: string[];
  firstTeamName?: string; // タイムラインと色を一致させるための基準チーム名
}

/**
 * EnhancedCodePanelの公開メソッド
 */
export interface EnhancedCodePanelHandle {
  /** 指定されたチームとアクションのボタンをトリガー */
  triggerAction: (teamName: string, actionName: string) => void;
}

/**
 * SportsCodeスタイルの階層的コードパネル
 * チームごとにアクションを表示し、ラベルグループ/ラベル構造をサポート
 */
export const EnhancedCodePanel = forwardRef<
  EnhancedCodePanelHandle,
  EnhancedCodePanelProps
>(({ addTimelineData, teamNames, firstTeamName }, ref) => {
  const { activeActions } = useActionPreset();

  // 選択状態
  const [selectedTeam, setSelectedTeam] = React.useState<string | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<string | null>(
    null,
  );
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingStartTime, setRecordingStartTime] = React.useState<number>(0);

  // 外部から呼び出せるメソッドを公開
  useImperativeHandle(ref, () => ({
    triggerAction: (teamName: string, actionName: string) => {
      const action = activeActions.find((a) => a.action === actionName);
      if (!action) {
        console.warn(
          `[EnhancedCodePanel] Action "${actionName}" not found in active actions`,
        );
        return;
      }
      handleActionClick(teamName, action);
    },
  }));

  // ラベルグループの選択状態を管理（groupName -> selected option）
  const [labelSelections, setLabelSelections] = React.useState<
    Record<string, string>
  >({});

  // 現在のビデオ時間を取得
  const getCurrentTime = React.useCallback((): number | null => {
    type VjsNamespace = {
      getPlayer?: (
        id: string,
      ) => { currentTime?: () => number | undefined } | undefined;
    };
    const ns = videojs as unknown as VjsNamespace;
    const player = ns.getPlayer?.('video_0');
    const currentTime = player?.currentTime?.();
    return typeof currentTime === 'number' && !Number.isNaN(currentTime)
      ? currentTime
      : null;
  }, []);

  // 記録完了してタイムラインに追加
  const completeRecording = React.useCallback(() => {
    if (!selectedAction || !selectedTeam) return;

    const endTime = getCurrentTime();
    if (endTime === null) return;

    const [begin, end] =
      endTime >= recordingStartTime
        ? [recordingStartTime, endTime]
        : [endTime, recordingStartTime];

    const fullActionName = `${selectedTeam} ${selectedAction}`;

    // labelSelectionsからlabels配列を生成
    const labels = Object.entries(labelSelections).map(([group, name]) => ({
      name,
      group,
    }));

    // labels配列を渡してタイムラインデータを追加
    addTimelineData(
      fullActionName,
      begin,
      end,
      '',
      undefined,
      undefined,
      labels.length > 0 ? labels : undefined,
    );

    // 選択状態をリセット
    setSelectedTeam(null);
    setSelectedAction(null);
    setLabelSelections({});
    setIsRecording(false);
  }, [
    selectedTeam,
    selectedAction,
    labelSelections,
    recordingStartTime,
    getCurrentTime,
    addTimelineData,
  ]);

  // アクションボタンクリック時の処理
  const handleActionClick = (teamName: string, action: ActionDefinition) => {
    const isSameAction =
      selectedTeam === teamName && selectedAction === action.action;

    const labelGroups = getActionLabels(action);
    const hasLabels = labelGroups.length > 0;

    // 記録中の同じアクションをクリックした場合は記録終了
    if (isRecording && isSameAction) {
      completeRecording();
      return;
    }

    // 記録中に別のアクションをクリックした場合
    if (isRecording && !isSameAction) {
      // 先に現在の記録を完了
      completeRecording();

      // 新しいアクションを選択して記録開始
      const time = getCurrentTime();
      if (time !== null) {
        setSelectedTeam(teamName);
        setSelectedAction(action.action);
        setLabelSelections({});
        setRecordingStartTime(time);
        setIsRecording(true);
      }
      return;
    }

    // 記録中でない場合の処理
    // ラベルがない場合は即座に記録開始
    if (!hasLabels) {
      const time = getCurrentTime();
      if (time !== null) {
        setSelectedTeam(teamName);
        setSelectedAction(action.action);
        setLabelSelections({});
        setRecordingStartTime(time);
        setIsRecording(true);
      }
      return;
    }

    // ラベルがある場合
    if (isSameAction) {
      // 既に選択済みのアクションを再度クリック -> 記録開始
      const time = getCurrentTime();
      if (time !== null) {
        setRecordingStartTime(time);
        setIsRecording(true);
      }
    } else {
      // 別のアクションを初めて選択 -> アクションを選択して記録開始
      const time = getCurrentTime();
      if (time !== null) {
        setSelectedTeam(teamName);
        setSelectedAction(action.action);
        setLabelSelections({});
        setRecordingStartTime(time);
        setIsRecording(true);
      }
    }
  };

  // ラベル選択ハンドラ
  const handleLabelSelect = (groupName: string, option: string) => {
    setLabelSelections((prev) => ({
      ...prev,
      [groupName]: option,
    }));
  };

  // アクションごとに表示するラベルグループを決定
  const getActionLabels = (action: ActionDefinition) => {
    // groups構造がある場合はそれを優先
    if (action.groups && action.groups.length > 0) {
      return action.groups;
    }

    // 後方互換性: results/typesから変換（Optaのデータ構造に合わせる）
    const legacyGroups = [];
    if (action.types.length > 0) {
      legacyGroups.push({ groupName: 'actionType', options: action.types });
    }
    if (action.results.length > 0) {
      legacyGroups.push({ groupName: 'actionResult', options: action.results });
    }
    return legacyGroups;
  };

  // ラベルグループのレンダリング（ネスト削減のため分離）
  const renderLabelGroup = (
    groupName: string,
    options: string[],
    isLastGroup: boolean,
  ) => {
    return (
      <Box key={groupName} sx={{ mb: isLastGroup ? 0 : 1 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}
        >
          {groupName}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 0.5,
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            width: '100%',
          }}
        >
          {options.map((option) => (
            <EnhancedCodeButton
              key={option}
              label={option}
              isSelected={labelSelections[groupName] === option}
              onClick={() => handleLabelSelect(groupName, option)}
              size="small"
              color="secondary"
            />
          ))}
        </Box>
      </Box>
    );
  };

  // チームごとのアクションボタンをレンダリング
  const renderTeamActions = (teamName: string) => {
    // タイムラインと同じロジックでチーム色を決定
    const referenceTeamName = firstTeamName || teamNames[0];
    const isFirstTeam = teamName === referenceTeamName;
    const color = isFirstTeam ? 'team1' : 'team2';

    return (
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            mb: 1,
            fontWeight: 'bold',
            color: `${color}.main`,
          }}
        >
          {teamName}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          {activeActions.map((action) => {
            const isSelected =
              selectedAction === action.action && selectedTeam === teamName;
            const labelGroups = getActionLabels(action);
            const hasLabels = labelGroups.length > 0;

            return (
              <Box key={action.action}>
                {/* アクションボタン */}
                <Button
                  variant={isSelected ? 'contained' : 'outlined'}
                  color={color}
                  onClick={() => handleActionClick(teamName, action)}
                  startIcon={
                    isRecording && isSelected ? (
                      <FiberManualRecordIcon
                        sx={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                      />
                    ) : undefined
                  }
                  sx={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    minHeight: 36,
                    fontSize: '0.8rem',
                    px: 1.5,
                    fontWeight: isSelected ? 'bold' : 'normal',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                >
                  {action.action}
                </Button>

                {/* 選択中のアクションの場合、ラベルグループ/ラベルを直下に表示 */}
                {isSelected && hasLabels && (
                  <Box
                    sx={{
                      mt: 0.5,
                      ml: 1,
                      p: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      borderLeft: 3,
                      borderColor: `${color}.main`,
                    }}
                  >
                    {labelGroups.map((group, groupIndex) =>
                      renderLabelGroup(
                        group.groupName,
                        group.options,
                        groupIndex === labelGroups.length - 1,
                      ),
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={6}>
          {teamNames[0] && renderTeamActions(teamNames[0])}
        </Grid>
        <Grid item xs={6}>
          {teamNames[1] && renderTeamActions(teamNames[1])}
        </Grid>
      </Grid>
    </Box>
  );
});

EnhancedCodePanel.displayName = 'EnhancedCodePanel';
