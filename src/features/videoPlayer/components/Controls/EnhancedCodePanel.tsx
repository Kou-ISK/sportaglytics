import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Box, Typography, Grid, Button } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import videojs from 'video.js';
import { EnhancedCodeButton } from './EnhancedCodeButton';
import { useActionPreset } from '../../../../contexts/ActionPresetContext';
import type {
  ActionDefinition,
  CodeWindowLayout,
  CodeWindowButton,
} from '../../../../types/Settings';
import { useSettings } from '../../../../hooks/useSettings';
import {
  replaceTeamPlaceholders,
  type TeamContext,
} from '../../../../utils/teamPlaceholder';

interface EnhancedCodePanelProps {
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    qualifier: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  teamNames: string[];
  firstTeamName?: string; // タイムラインと色を一致させるための基準チーム名
  selectedIds?: string[];
  onApplyLabels?: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
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
>(
  (
    {
      addTimelineData,
      teamNames,
      firstTeamName,
      selectedIds = [],
      onApplyLabels,
    },
    ref,
  ) => {
    const { activeActions } = useActionPreset();
    const { settings } = useSettings();

    // チーム名コンテキスト（プレースホルダー置換用）
    const teamContext: TeamContext = useMemo(
      () => ({
        team1Name: teamNames[0] || 'Team1',
        team2Name: teamNames[1] || 'Team2',
      }),
      [teamNames],
    );

    // カスタムレイアウトを取得
    const customLayout = useMemo((): CodeWindowLayout | null => {
      if (
        !settings.codingPanel?.layouts ||
        !settings.codingPanel?.activeLayoutId
      ) {
        return null;
      }
      return (
        settings.codingPanel.layouts.find(
          (l) => l.id === settings.codingPanel?.activeLayoutId,
        ) || null
      );
    }, [settings.codingPanel?.layouts, settings.codingPanel?.activeLayoutId]);

    // 選択状態
    const [selectedTeam, setSelectedTeam] = React.useState<string | null>(null);
    const [selectedAction, setSelectedAction] = React.useState<string | null>(
      null,
    );
    // 選択中のアクションの色（タイムラインに反映）
    const [selectedActionColor, setSelectedActionColor] = React.useState<
      string | undefined
    >(undefined);
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingStartTime, setRecordingStartTime] =
      React.useState<number>(0);
    // Activateリンクで同時に記録するターゲット
    const [activateTargets, setActivateTargets] = React.useState<string[]>([]);
    // Activateリンクターゲットの色
    const [activateTargetColors, setActivateTargetColors] = React.useState<
      Record<string, string | undefined>
    >({});

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
    const [activeMode, setActiveMode] = React.useState<'code' | 'label'>(
      settings.codingPanel?.defaultMode ?? 'code',
    );
    // （ツールバー機能は未使用）
    const [actionLinks, setActionLinks] = React.useState<
      {
        from: string;
        to: string;
        type: 'exclusive' | 'deactivate' | 'activate';
      }[]
    >(settings.codingPanel?.actionLinks ?? []);
    const [warning, setWarning] = React.useState<string | null>(null);
    const recentActionsRef = React.useRef<string[]>([]);
    // ラベルボタンの一時的なアクティブ状態（ボタンID -> true）
    const [activeLabelButtons, setActiveLabelButtons] = React.useState<
      Record<string, boolean>
    >({});

    React.useEffect(() => {
      if (settings.codingPanel?.actionLinks) {
        setActionLinks(
          settings.codingPanel.actionLinks.map((l) => ({
            from: l.from || l.to || '',
            to: l.to || '',
            type: l.type || 'exclusive',
          })),
        );
      }
      if (settings.codingPanel?.defaultMode) {
        setActiveMode(settings.codingPanel.defaultMode as 'code' | 'label');
      }
    }, [settings.codingPanel]);

    // メニューからのモード切替
    React.useEffect(() => {
      if (!globalThis.window.electronAPI?.onCodingModeChange) return;
      const handler = (mode: 'code' | 'label') => setActiveMode(mode);
      globalThis.window.electronAPI.onCodingModeChange(handler);
      return () => {
        // removeListenerは未実装だが、preloadでremoveAllListenersしているためOK
      };
    }, []);

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
      if (!selectedAction) return;

      const endTime = getCurrentTime();
      if (endTime === null) return;

      const [begin, end] =
        endTime >= recordingStartTime
          ? [recordingStartTime, endTime]
          : [endTime, recordingStartTime];

      // selectedActionにはボタン名全体が入っているのでそのまま使用
      const fullActionName = selectedAction;

      // labelSelectionsからlabels配列を生成
      const labels = Object.entries(labelSelections).map(([group, name]) => ({
        name,
        group,
      }));

      // メインアクションをタイムラインに追加（色付き）
      addTimelineData(
        fullActionName,
        begin,
        end,
        '',
        undefined,
        undefined,
        labels.length > 0 ? labels : undefined,
        selectedActionColor,
      );

      // Activateリンクのターゲットも同じ時間範囲で追加（ターゲットの色付き）
      // ターゲット名（ボタン名）をそのまま使用
      activateTargets.forEach((targetName) => {
        addTimelineData(
          targetName,
          begin,
          end,
          '',
          undefined,
          undefined,
          undefined,
          activateTargetColors[targetName],
        );
      });

      // 選択状態をリセット
      setSelectedTeam(null);
      setSelectedAction(null);
      setSelectedActionColor(undefined);
      setLabelSelections({});
      setIsRecording(false);
      setActivateTargets([]);
      setActivateTargetColors({});

      // Exclusive/Deactivateリンクの後処理: 完了したアクションとリンクされた相手を履歴から落とす
      recentActionsRef.current = recentActionsRef.current.filter(
        (a) => a !== selectedAction,
      );
    }, [
      selectedTeam,
      selectedAction,
      selectedActionColor,
      labelSelections,
      recordingStartTime,
      getCurrentTime,
      addTimelineData,
      activateTargets,
      activateTargetColors,
    ]);

    // ボタンIDからボタン名を取得するヘルパー
    const getButtonNameById = React.useCallback(
      (buttonId: string): string | null => {
        if (!customLayout) return null;
        const button = customLayout.buttons.find((b) => b.id === buttonId);
        return button?.name || null;
      },
      [customLayout],
    );

    // ボタン名から色を取得するヘルパー（プレースホルダー置換後の名前で検索）
    const getButtonColorByName = React.useCallback(
      (buttonName: string): string | undefined => {
        if (!customLayout) return undefined;
        const button = customLayout.buttons.find(
          (b) => replaceTeamPlaceholders(b.name, teamContext) === buttonName,
        );
        return button?.color;
      },
      [customLayout, teamContext],
    );

    // カスタムレイアウトのbuttonLinksをアクション名ベースに変換
    // カスタムレイアウトのbuttonLinksをアクション名ベースに変換
    // プレースホルダーも置換して実際のチーム名で比較できるようにする
    const effectiveLinks = React.useMemo(() => {
      const links: {
        from: string;
        to: string;
        type: 'exclusive' | 'deactivate' | 'activate';
      }[] = [];

      // 旧式のactionLinksを追加（プレースホルダー置換）
      actionLinks.forEach((l) => {
        links.push({
          from: replaceTeamPlaceholders(l.from, teamContext),
          to: replaceTeamPlaceholders(l.to, teamContext),
          type: l.type,
        });
      });

      // カスタムレイアウトのbuttonLinksを変換して追加（プレースホルダー置換）
      if (customLayout?.buttonLinks) {
        customLayout.buttonLinks.forEach((bl) => {
          const fromName = getButtonNameById(bl.fromButtonId);
          const toName = getButtonNameById(bl.toButtonId);
          if (fromName && toName && bl.type !== 'sequence') {
            links.push({
              from: replaceTeamPlaceholders(fromName, teamContext),
              to: replaceTeamPlaceholders(toName, teamContext),
              type: bl.type as 'exclusive' | 'deactivate' | 'activate',
            });
          }
        });
      }

      return links;
    }, [actionLinks, customLayout, getButtonNameById, teamContext]);

    // アクションボタンクリック時の処理
    // originalButtonName: カスタムレイアウトからの呼び出し時に元のボタン名を渡す
    // buttonColor: ボタンの色（タイムラインに反映）
    const handleActionClick = (
      teamName: string,
      action: ActionDefinition,
      originalButtonName?: string,
      buttonColor?: string,
    ) => {
      // リンク比較用のボタン名（カスタムレイアウトの場合はボタン名、それ以外はアクション名）
      const clickedButtonName = originalButtonName || action.action;

      // リンク処理
      const relatedLinks = effectiveLinks.filter(
        (r) => r.from === clickedButtonName || r.to === clickedButtonName,
      );

      // Activateリンクの処理（記録開始前に処理）
      // クリックしたボタンがfromの場合、toも開始する
      const newActivateTargets: string[] = [];
      if (relatedLinks.length > 0) {
        for (const linkRule of relatedLinks) {
          if (
            linkRule.type === 'activate' &&
            linkRule.from === clickedButtonName
          ) {
            newActivateTargets.push(linkRule.to);
          }
        }
      }

      // 現在記録中のアクションがリンクで影響を受けるかチェック
      if (relatedLinks.length > 0 && isRecording && selectedAction) {
        for (const linkRule of relatedLinks) {
          // Exclusive: 相手方が記録中なら自動終了
          if (linkRule.type === 'exclusive') {
            const counterpart =
              linkRule.from === clickedButtonName ? linkRule.to : linkRule.from;
            if (selectedAction === counterpart) {
              setWarning(`排他リンク: ${counterpart} を終了します`);
              // 現在の記録を終了
              completeRecording();
              break;
            }
          }

          // Deactivate: クリックしたボタンがfromで、toが記録中なら終了
          if (
            linkRule.type === 'deactivate' &&
            linkRule.from === clickedButtonName &&
            selectedAction === linkRule.to
          ) {
            setWarning(`非活性化: ${linkRule.to} を終了します`);
            // リンク先の記録を終了
            completeRecording();
            break;
          }
        }
      }

      // selectedActionにはボタン名全体が入っているので、clickedButtonNameと比較
      const isSameAction = selectedAction === clickedButtonName;

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
          setSelectedAction(clickedButtonName);
          setSelectedActionColor(buttonColor);
          setLabelSelections({});
          setRecordingStartTime(time);
          setIsRecording(true);
          setActivateTargets(newActivateTargets);
          // Activateターゲットの色を設定
          const targetColors: Record<string, string | undefined> = {};
          newActivateTargets.forEach((target) => {
            targetColors[target] = getButtonColorByName(target);
          });
          setActivateTargetColors(targetColors);
          if (newActivateTargets.length > 0) {
            setWarning(
              `活性化リンク: ${newActivateTargets.join(', ')} も記録します`,
            );
          }
        }
        return;
      }

      // 記録中でない場合の処理
      // ラベルがない場合は即座に記録開始
      if (!hasLabels) {
        const time = getCurrentTime();
        if (time !== null) {
          setSelectedTeam(teamName);
          setSelectedAction(clickedButtonName);
          setSelectedActionColor(buttonColor);
          setLabelSelections({});
          setRecordingStartTime(time);
          setIsRecording(true);
          setActivateTargets(newActivateTargets);
          // Activateターゲットの色を設定
          const targetColors: Record<string, string | undefined> = {};
          newActivateTargets.forEach((target) => {
            targetColors[target] = getButtonColorByName(target);
          });
          setActivateTargetColors(targetColors);
          if (newActivateTargets.length > 0) {
            setWarning(
              `活性化リンク: ${newActivateTargets.join(', ')} も記録します`,
            );
          }
          recentActionsRef.current = [
            ...recentActionsRef.current.slice(-10),
            action.action,
          ];
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
          setActivateTargets(newActivateTargets);
          // Activateターゲットの色を設定
          const targetColors: Record<string, string | undefined> = {};
          newActivateTargets.forEach((target) => {
            targetColors[target] = getButtonColorByName(target);
          });
          setActivateTargetColors(targetColors);
          if (newActivateTargets.length > 0) {
            setWarning(
              `活性化リンク: ${newActivateTargets.join(', ')} も記録します`,
            );
          }
          recentActionsRef.current = [
            ...recentActionsRef.current.slice(-10),
            action.action,
          ];
        }
      } else {
        // 別のアクションを初めて選択 -> アクションを選択して記録開始
        const time = getCurrentTime();
        if (time !== null) {
          setSelectedTeam(teamName);
          setSelectedAction(clickedButtonName);
          setSelectedActionColor(buttonColor);
          setLabelSelections({});
          setRecordingStartTime(time);
          setIsRecording(true);
          setActivateTargets(newActivateTargets);
          // Activateターゲットの色を設定
          const targetColors: Record<string, string | undefined> = {};
          newActivateTargets.forEach((target) => {
            targetColors[target] = getButtonColorByName(target);
          });
          setActivateTargetColors(targetColors);
          if (newActivateTargets.length > 0) {
            setWarning(
              `活性化リンク: ${newActivateTargets.join(', ')} も記録します`,
            );
          }
          recentActionsRef.current = [
            ...recentActionsRef.current.slice(-10),
            action.action,
          ];
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
        legacyGroups.push({
          groupName: 'actionResult',
          options: action.results,
        });
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
                onClick={() =>
                  activeMode === 'label'
                    ? handleApplyLabel(groupName, option)
                    : handleLabelSelect(groupName, option)
                }
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

    // ラベルモード用のユニークラベル一覧
    const allLabelGroups = React.useMemo(() => {
      const map = new Map<string, Set<string>>();
      activeActions.forEach((action) => {
        getActionLabels(action).forEach((group) => {
          const set = map.get(group.groupName) || new Set<string>();
          group.options.forEach((opt) => set.add(opt));
          map.set(group.groupName, set);
        });
      });
      return Array.from(map.entries()).map(([groupName, set]) => ({
        groupName,
        options: Array.from(set),
      }));
    }, [activeActions, getActionLabels]);

    const handleApplyLabel = (groupName: string, option: string) => {
      if (!onApplyLabels || selectedIds.length === 0) {
        setWarning('タイムラインのアクションを選択してください');
        return;
      }
      onApplyLabels(selectedIds, [{ group: groupName, name: option }]);
      setWarning(null);
    };

    // カスタムレイアウトのボタンをクリックした時の処理
    // Sportscode方式: ボタン名にプレースホルダー ${Team1}, ${Team2} を使用可能
    const handleCustomButtonClick = (button: CodeWindowButton) => {
      if (button.type === 'action') {
        // プレースホルダーを実際のチーム名に置換
        const buttonName = replaceTeamPlaceholders(button.name, teamContext);

        // チーム名が含まれているかチェック（置換後）
        const matchedTeam = teamNames.find((t) =>
          buttonName.startsWith(`${t} `),
        );
        let teamName: string;
        let actionName: string;

        if (matchedTeam) {
          // 「チーム名 アクション名」形式
          teamName = matchedTeam;
          actionName = buttonName.slice(matchedTeam.length + 1);
        } else {
          // 単純なアクション名（デフォルトで最初のチームを使用）
          teamName = teamNames[0] || 'Team';
          actionName = buttonName;
        }

        // ボタンの色を取得
        const buttonColor = button.color;

        // アクション定義を探す（ラベルグループ取得のため）
        const action = activeActions.find((a) => a.action === actionName);
        if (action) {
          // 置換後のボタン名と色を渡してリンク比較・記録に使用
          handleActionClick(teamName, action, buttonName, buttonColor);
        } else {
          // アクション定義がない場合は仮の定義を使って直接記録
          const fakeAction: ActionDefinition = {
            action: actionName,
            types: [],
            results: [],
            groups: [],
          };
          // 置換後のボタン名と色を渡してリンク比較・記録に使用
          handleActionClick(teamName, fakeAction, buttonName, buttonColor);
        }
      } else if (button.type === 'label' && button.labelValue) {
        // ラベルボタンからのリンク処理
        // ラベルボタンは押下した瞬間のみ機能（startTime/endTime を記録しない）
        // 1回のクリックでDeactivateとActivateの両方を同時に実行
        // プレースホルダーを実際のチーム名に置換
        const labelButtonName = replaceTeamPlaceholders(
          button.name,
          teamContext,
        );

        // ラベルボタンを1秒間アクティブ表示
        setActiveLabelButtons((prev) => ({ ...prev, [button.id]: true }));
        setTimeout(() => {
          setActiveLabelButtons((prev) => ({ ...prev, [button.id]: false }));
        }, 1000);

        const relatedLinks = effectiveLinks.filter(
          (r) => r.from === labelButtonName || r.to === labelButtonName,
        );

        // Deactivate: ラベルボタンがfromで、toが記録中なら終了
        if (relatedLinks.length > 0 && isRecording && selectedAction) {
          for (const linkRule of relatedLinks) {
            if (
              linkRule.type === 'deactivate' &&
              linkRule.from === labelButtonName &&
              selectedAction === linkRule.to
            ) {
              setWarning(`非活性化: ${linkRule.to} を終了します`);
              completeRecording();
              break;
            }
          }
        }

        // Activate: ラベルボタンがfromの場合、toのアクションの記録を開始
        // ラベルボタンは1回のクリックでDeactivate→Activateを連続実行
        // isRecordingの状態に関係なく、Activateリンクがあれば記録を開始
        for (const linkRule of relatedLinks) {
          if (
            linkRule.type === 'activate' &&
            linkRule.from === labelButtonName
          ) {
            const targetActionName = linkRule.to;
            const time = getCurrentTime();
            if (time !== null) {
              // リンク先アクションの記録を開始
              setSelectedTeam(teamNames[0] || 'Team');
              setSelectedAction(targetActionName);
              setLabelSelections({});
              setRecordingStartTime(time);
              setIsRecording(true);
              setActivateTargets([]);
              setWarning(
                `活性化リンク: ${targetActionName} の記録を開始しました`,
              );
              break; // 最初のActivateリンクのみ処理
            }
          }
        }

        // ラベル適用処理（ラベルモードの場合のみ）
        // ラベルボタンは一時的なハイライトのみ（labelSelectionsへの登録は不要）
        if (activeMode === 'label') {
          handleApplyLabel(button.name, button.labelValue);
        }
      }
    };

    // カスタムレイアウトをレンダリング（自由配置対応、Sportscode方式）
    const renderCustomLayout = (layout: CodeWindowLayout) => {
      // 全ボタンを表示（チームフィルターなし）
      const allButtons = layout.buttons;

      // スケール係数を計算（コンテナに収める）
      const containerWidth = 700; // コンテナの幅（全幅表示）
      const scale = containerWidth / layout.canvasWidth;
      const containerHeight = layout.canvasHeight * scale;

      return (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              position: 'relative',
              width: containerWidth,
              height: containerHeight,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {allButtons.map((button) => {
              // プレースホルダーを置換したボタン名
              const resolvedButtonName = replaceTeamPlaceholders(
                button.name,
                teamContext,
              );
              // selectedActionには置換後のボタン名が入っているので、置換後で比較
              const isSelected =
                button.type === 'action' &&
                selectedAction === resolvedButtonName;
              // ラベルボタンは一時的なアクティブ状態（1秒間）のみ表示
              const isLabelSelected =
                button.type === 'label' && activeLabelButtons[button.id];

              const buttonColor =
                button.color ||
                (button.type === 'action' ? '#1976d2' : '#9c27b0');
              // 表示テキストもプレースホルダーを置換
              const displayText =
                button.type === 'label' && button.labelValue
                  ? button.labelValue
                  : resolvedButtonName;

              return (
                <Box
                  key={button.id}
                  onClick={() => handleCustomButtonClick(button)}
                  sx={{
                    position: 'absolute',
                    left: button.x * scale,
                    top: button.y * scale,
                    width: button.width * scale,
                    height: button.height * scale,
                    minWidth: 0,
                    px: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      button.textAlign === 'left'
                        ? 'flex-start'
                        : button.textAlign === 'right'
                          ? 'flex-end'
                          : 'center',
                    fontSize: `${Math.max(0.6, 0.75 * scale)}rem`,
                    fontWeight: 500,
                    backgroundColor:
                      isSelected || isLabelSelected
                        ? buttonColor
                        : 'transparent',
                    color:
                      isSelected || isLabelSelected
                        ? button.textColor || '#fff'
                        : buttonColor,
                    border: `1px solid ${buttonColor}`,
                    borderRadius: `${(button.borderRadius ?? 4) * scale}px`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    overflow: 'hidden',
                    '&:hover': {
                      backgroundColor:
                        isSelected || isLabelSelected
                          ? buttonColor
                          : `${buttonColor}22`,
                    },
                    '&:active': {
                      transform: 'scale(0.98)',
                    },
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                >
                  {/* 録画アイコン */}
                  {isRecording && isSelected && (
                    <FiberManualRecordIcon
                      sx={{
                        fontSize: '0.75rem',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        color: 'error.main',
                        mr: 0.25,
                      }}
                    />
                  )}
                  {/* テキスト */}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayText}
                  </span>
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1,
            flexWrap: 'wrap',
          }}
        ></Box>

        {warning && (
          <Typography color="warning.main" variant="body2" sx={{ mb: 1 }}>
            {warning}
          </Typography>
        )}

        {activeMode === 'label' && (
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}
          >
            {allLabelGroups.map((group, idx) =>
              renderLabelGroup(
                group.groupName,
                group.options,
                idx === allLabelGroups.length - 1,
              ),
            )}
          </Box>
        )}

        {activeMode === 'code' && customLayout ? (
          // カスタムレイアウトモード（Sportscode方式: 1回だけレンダリング）
          <Box>{renderCustomLayout(customLayout)}</Box>
        ) : (
          activeMode === 'code' && (
            // デフォルトモード
            <Grid container spacing={2}>
              <Grid item xs={6}>
                {teamNames[0] && renderTeamActions(teamNames[0])}
              </Grid>
              <Grid item xs={6}>
                {teamNames[1] && renderTeamActions(teamNames[1])}
              </Grid>
            </Grid>
          )
        )}
      </Box>
    );
  },
);

EnhancedCodePanel.displayName = 'EnhancedCodePanel';
