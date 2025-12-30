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

type LabelSelectionsMap = Record<string, Record<string, string>>;

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

    // 複数同時録画に対応するため、アクションごとにセッションを保持
    const [activeRecordings, setActiveRecordings] = React.useState<
      Record<
        string,
        {
          teamName: string;
          startTime: number;
          color?: string;
          activateTargets: string[];
          activateTargetColors: Record<string, string | undefined>;
        }
      >
    >({});
    // ラベル入力の対象となるアクション（最後に操作したもの）
    const [primaryAction, setPrimaryAction] = React.useState<string | null>(
      null,
    );
    const activeRecordingsRef = React.useRef<typeof activeRecordings>({});
    React.useEffect(() => {
      activeRecordingsRef.current = activeRecordings;
    }, [activeRecordings]);
    const isSameActionName = React.useCallback(
      (a: string, b: string): boolean => {
        if (a === b) return true;
        for (const team of teamNames) {
          const prefix = `${team} `;
          const aStripped = a.startsWith(prefix) ? a.slice(prefix.length) : a;
          const bStripped = b.startsWith(prefix) ? b.slice(prefix.length) : b;
          if (
            aStripped === b ||
            bStripped === a ||
            aStripped === bStripped ||
            `${prefix}${b}` === a ||
            `${prefix}${a}` === b
          ) {
            return true;
          }
        }
        return false;
      },
      [teamNames],
    );
    const resolveRecordingKey = React.useCallback(
      (name: string): string | undefined => {
        if (activeRecordingsRef.current[name]) return name;
        for (const team of teamNames) {
          const teamPrefix = `${team} `;
          if (name.startsWith(teamPrefix)) {
            const stripped = name.slice(teamPrefix.length);
            if (activeRecordingsRef.current[stripped]) return stripped;
          }
          const prefixed = `${teamPrefix}${name}`;
          if (activeRecordingsRef.current[prefixed]) return prefixed;
        }
        return undefined;
      },
      [teamNames],
    );

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
    const [labelSelections, setLabelSelections] =
      React.useState<LabelSelectionsMap>({});
    const labelSelectionsRef = React.useRef<LabelSelectionsMap>({});
    React.useEffect(() => {
      labelSelectionsRef.current = labelSelections;
    }, [labelSelections]);
    const updateLabelSelections = React.useCallback(
      (
        updater: LabelSelectionsMap | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
      ) => {
        setLabelSelections((prev) => {
          const next =
            typeof updater === 'function'
              ? (updater as (p: LabelSelectionsMap) => LabelSelectionsMap)(prev)
              : updater;
          labelSelectionsRef.current = next;
          return next;
        });
      },
      [],
    );
    const isRecording = React.useMemo(
      () => Object.keys(activeRecordings).length > 0,
      [activeRecordings],
    );
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

    // 記録完了してタイムラインに追加（アクションごと）
    const completeRecording = React.useCallback(
      (actionName: string, labelsPatch?: Record<string, string>) => {
        setActiveRecordings((prev) => {
          const session = prev[actionName];
          if (!session) return prev;

          const endTime = getCurrentTime();
          if (endTime === null) return prev;

          const [begin, end] =
            endTime >= session.startTime
              ? [session.startTime, endTime]
              : [endTime, session.startTime];

          const labelsMap = {
            ...(labelSelectionsRef.current[actionName] ?? {}),
            ...(labelsPatch ?? {}),
          };
          const labels = Object.entries(labelsMap).map(([group, name]) => ({
            name,
            group,
          }));

          // メインアクションをタイムラインに追加（色付き）
          addTimelineData(
            actionName,
            begin,
            end,
            '',
            undefined,
            undefined,
            labels.length > 0 ? labels : undefined,
            session.color,
          );

          // Activateリンクのターゲットも同じ時間範囲で追加（ターゲットの色付き）
          session.activateTargets.forEach((targetName) => {
            addTimelineData(
              targetName,
              begin,
              end,
              '',
              undefined,
              undefined,
              undefined,
              session.activateTargetColors[targetName],
            );
          });

          updateLabelSelections((prevLabels) => {
            const nextLabels = { ...prevLabels };
            delete nextLabels[actionName];
            return nextLabels;
          });
          setPrimaryAction((prev) =>
            prev === actionName ? null : prev,
          );
          recentActionsRef.current = recentActionsRef.current.filter(
            (a) => a !== actionName,
          );

          const next = { ...prev };
          delete next[actionName];
          return next;
        });
      },
      [addTimelineData, getCurrentTime, updateLabelSelections],
    );

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
      const activeKey = resolveRecordingKey(clickedButtonName);
      setPrimaryAction(clickedButtonName);

      // リンク処理
      const relatedLinks = effectiveLinks.filter(
        (r) =>
          isSameActionName(r.from, clickedButtonName) ||
          isSameActionName(r.to, clickedButtonName),
      );

      // Activateリンクの処理（記録開始前に処理）
      // クリックしたボタンがfromの場合、toも開始する
      const newActivateTargets: string[] = [];
      if (relatedLinks.length > 0) {
        for (const linkRule of relatedLinks) {
          if (
            linkRule.type === 'activate' &&
            isSameActionName(linkRule.from, clickedButtonName)
          ) {
            newActivateTargets.push(linkRule.to);
          }
        }
      }

      // 既存の録画に対してリンクで終了させるべきものを処理
      if (relatedLinks.length > 0) {
        for (const linkRule of relatedLinks) {
          if (linkRule.type === 'exclusive') {
            const counterpart =
              isSameActionName(linkRule.from, clickedButtonName)
                ? linkRule.to
                : linkRule.from;
            const counterpartKey = resolveRecordingKey(counterpart);
            if (counterpartKey) {
              setWarning(`排他リンク: ${counterpart} を終了します`);
              completeRecording(counterpartKey);
            }
          }
          if (
            linkRule.type === 'deactivate' &&
            isSameActionName(linkRule.from, clickedButtonName)
          ) {
            const targetKey = resolveRecordingKey(linkRule.to);
            if (targetKey) {
              setWarning(`非活性化: ${linkRule.to} を終了します`);
              completeRecording(targetKey);
            }
          }
        }
      }

      const isActive = Boolean(activeKey);

      // 記録中でない場合の処理
      // 記録中の同じアクションをクリックした場合は記録終了
      if (isActive && activeKey) {
        completeRecording(activeKey);
        return;
      }

      // 新しいアクションの録画を開始（他の録画は継続）
      const time = getCurrentTime();
      if (time !== null) {
        const targetColors: Record<string, string | undefined> = {};
        newActivateTargets.forEach((target) => {
          targetColors[target] = getButtonColorByName(target);
        });
        setActiveRecordings((prev) => ({
          ...prev,
          [clickedButtonName]: {
            teamName,
            startTime: time,
            color: buttonColor,
            activateTargets: newActivateTargets,
            activateTargetColors: targetColors,
          },
        }));
        updateLabelSelections((prev) => ({
          ...prev,
          [clickedButtonName]: prev[clickedButtonName] ?? {},
        }));
        if (newActivateTargets.length > 0) {
          setWarning(
            `活性化リンク: ${newActivateTargets.join(', ')} も記録します`,
          );
        } else {
          setWarning(null);
        }
        recentActionsRef.current = [
          ...recentActionsRef.current.slice(-10),
          action.action,
        ];
      }
    };

    // ラベル選択ハンドラ（アクション単位で保持）
    const handleLabelSelect = (
      actionName: string,
      groupName: string,
      option: string,
    ) => {
      updateLabelSelections((prev) => {
        const current = prev[actionName] ?? {};
        return {
          ...prev,
          [actionName]: {
            ...current,
            [groupName]: option,
          },
        };
      });
      setPrimaryAction(actionName);
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
      actionName: string,
      groupName: string,
      options: string[],
      isLastGroup: boolean,
    ) => {
      const selectionForAction = labelSelections[actionName] ?? {};
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
                isSelected={selectionForAction[groupName] === option}
                onClick={() =>
                  activeMode === 'label'
                    ? handleApplyLabel(groupName, option)
                    : handleLabelSelect(actionName, groupName, option)
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
            const isActive = Boolean(activeRecordings[action.action]);
            const isSelected = isActive || primaryAction === action.action;
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
                      isActive ? (
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
                          action.action,
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
        const labelValue = button.labelValue!;

        // ラベルボタンを1秒間アクティブ表示
        setActiveLabelButtons((prev) => ({ ...prev, [button.id]: true }));
        setTimeout(() => {
          setActiveLabelButtons((prev) => ({ ...prev, [button.id]: false }));
        }, 1000);

        const relatedLinks = effectiveLinks.filter(
          (r) =>
            isSameActionName(r.from, labelButtonName) ||
            isSameActionName(r.to, labelButtonName),
        );

        // Deactivate: ラベルボタンがfromで、toが記録中なら終了候補として控える
        const toDeactivate: string[] = [];
        if (relatedLinks.length > 0) {
          for (const linkRule of relatedLinks) {
            if (
              linkRule.type === 'deactivate' &&
              isSameActionName(linkRule.from, labelButtonName)
            ) {
              const targetKey = resolveRecordingKey(linkRule.to);
              if (targetKey) {
                setWarning(`非活性化: ${linkRule.to} を終了します`);
                toDeactivate.push(targetKey);
                break;
              }
            }
          }
        }

        // Activate: ラベルボタンがfromの場合、toのアクションの記録を開始
        // ラベルボタンは1回のクリックでDeactivate→Activateを連続実行
        // isRecordingの状態に関係なく、Activateリンクがあれば記録を開始
        const newlyStarted: string[] = [];
        for (const linkRule of relatedLinks) {
          if (
            linkRule.type === 'activate' &&
            isSameActionName(linkRule.from, labelButtonName)
          ) {
            const targetActionName = linkRule.to;
            const time = getCurrentTime();
            if (time !== null) {
              const targetColors: Record<string, string | undefined> = {};
              setActiveRecordings((prev) => ({
                ...prev,
                [targetActionName]: {
                  teamName: teamNames[0] || 'Team',
                  startTime: time,
                  color: getButtonColorByName(targetActionName) ?? button.color,
                  activateTargets: [],
                  activateTargetColors: targetColors,
                },
              }));
              updateLabelSelections((prev) => ({
                ...prev,
                [targetActionName]: prev[targetActionName] ?? {},
              }));
              setPrimaryAction(targetActionName);
              setWarning(
                `活性化リンク: ${targetActionName} の記録を開始しました`,
              );
              newlyStarted.push(targetActionName);
              break; // 最初のActivateリンクのみ処理
            }
          }
        }

        // ラベル適用処理（ラベルモードの場合のみ）
        // ラベルボタンは一時的なハイライトのみ（labelSelectionsへの登録は不要）
        // 記録中に押下された場合は現在の記録にラベルを紐づける
        const targetActions = new Set<string>([
          ...Object.keys(activeRecordingsRef.current),
          ...toDeactivate,
        ]);
        if (targetActions.size > 0) {
          updateLabelSelections((prev) => {
            const next = { ...prev };
            targetActions.forEach((actionName) => {
              const current = next[actionName] ?? {};
              next[actionName] = { ...current, [labelButtonName]: labelValue };
            });
            return next;
          });
        }
        // ラベル付与を確定させた後で、Deactivate対象を終了する
        toDeactivate.forEach((actionName) =>
          completeRecording(actionName, { [labelButtonName]: labelValue }),
        );
        if (activeMode === 'label') {
          handleApplyLabel(button.name, labelValue);
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
              const isActive =
                button.type === 'action' &&
                Boolean(activeRecordings[resolvedButtonName]);
              const isSelected =
                isActive || primaryAction === resolvedButtonName;
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
              '__label-mode__',
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
