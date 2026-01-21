import { useCallback } from 'react';
import type {
  ActionDefinition,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../../types/Settings';
import { replaceTeamPlaceholders, type TeamContext } from '../../../../../utils/teamPlaceholder';
import type { EffectiveLink } from '../effectiveLinks';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { LabelSelectionsMap } from './useLabelSelections';

type UseCodePanelInteractionsParams = {
  activeMode: 'code' | 'label';
  activeActions: ActionDefinition[];
  teamNames: string[];
  teamContext: TeamContext;
  selectedIds: string[];
  onApplyLabels?: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
  customLayout: CodeWindowLayout | null;
  effectiveLinks: EffectiveLink[];
  isSameActionName: (a: string, b: string) => boolean;
  resolveRecordingKey: (name: string) => string | undefined;
  getCurrentTime: () => number | null;
  setActiveRecordings: React.Dispatch<
    React.SetStateAction<Record<string, ActiveRecordingSession>>
  >;
  updateLabelSelections: (
    updater:
      | LabelSelectionsMap
      | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
  ) => void;
  setPrimaryAction: React.Dispatch<React.SetStateAction<string | null>>;
  setWarning: (message: string | null) => void;
  completeRecording: (actionName: string, labelsPatch?: Record<string, string>) => void;
  recentActionsRef: React.MutableRefObject<string[]>;
  activeRecordingsRef: React.MutableRefObject<
    Record<string, ActiveRecordingSession>
  >;
  setActiveLabelButtons: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
};

export const useCodePanelInteractions = ({
  activeMode,
  activeActions,
  teamNames,
  teamContext,
  selectedIds,
  onApplyLabels,
  customLayout,
  effectiveLinks,
  isSameActionName,
  resolveRecordingKey,
  getCurrentTime,
  setActiveRecordings,
  updateLabelSelections,
  setPrimaryAction,
  setWarning,
  completeRecording,
  recentActionsRef,
  activeRecordingsRef,
  setActiveLabelButtons,
}: UseCodePanelInteractionsParams) => {
  const getButtonColorByName = useCallback(
    (buttonName: string): string | undefined => {
      if (!customLayout) return undefined;
      const button = customLayout.buttons.find(
        (b) => replaceTeamPlaceholders(b.name, teamContext) === buttonName,
      );
      return button?.color;
    },
    [customLayout, teamContext],
  );

  const matchesLinkTarget = useCallback(
    (link: EffectiveLink, targetName: string, targetId?: string) => {
      if (targetId && (link.fromId || link.toId)) {
        return link.fromId === targetId || link.toId === targetId;
      }
      return (
        isSameActionName(link.from, targetName) ||
        isSameActionName(link.to, targetName)
      );
    },
    [isSameActionName],
  );

  const handleApplyLabel = useCallback(
    (groupName: string, option: string) => {
      if (!onApplyLabels || selectedIds.length === 0) {
        setWarning('タイムラインのアクションを選択してください');
        return;
      }
      onApplyLabels(selectedIds, [{ group: groupName, name: option }]);
      setWarning(null);
    },
    [onApplyLabels, selectedIds, setWarning],
  );

  const handleActionClick = useCallback(
    (
      teamName: string,
      action: ActionDefinition,
      originalButtonName?: string,
      buttonColor?: string,
      buttonId?: string,
    ) => {
      // ラベルモード時はアクションボタンを無効化
      if (activeMode === 'label') {
        return;
      }

      // リンク比較用のボタン名（カスタムレイアウトの場合はボタン名、それ以外はアクション名）
      const clickedButtonName = originalButtonName || action.action;
      const activeKey = resolveRecordingKey(clickedButtonName);
      setPrimaryAction(clickedButtonName);

      // リンク処理
      const relatedLinks = effectiveLinks.filter((link) =>
        matchesLinkTarget(link, clickedButtonName, buttonId),
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
            const counterpart = isSameActionName(
              linkRule.from,
              clickedButtonName,
            )
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
    },
    [
      activeMode,
      completeRecording,
      effectiveLinks,
      getButtonColorByName,
      getCurrentTime,
      isSameActionName,
      matchesLinkTarget,
      recentActionsRef,
      resolveRecordingKey,
      setActiveRecordings,
      setPrimaryAction,
      setWarning,
      updateLabelSelections,
    ],
  );

  const handleLabelSelect = useCallback(
    (actionName: string, groupName: string, option: string) => {
      // ラベルモード時は選択中のアクションインスタンスにラベルを適用
      if (activeMode === 'label') {
        handleApplyLabel(groupName, option);
        return;
      }

      // コードモード時は録画中のアクションにラベルを紐付け
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
    },
    [activeMode, handleApplyLabel, setPrimaryAction, updateLabelSelections],
  );

  const getActionLabels = useCallback((action: ActionDefinition) => {
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
  }, []);

  const handleCustomButtonClick = useCallback(
    (button: CodeWindowButton) => {
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
          handleActionClick(
            teamName,
            action,
            buttonName,
            buttonColor,
            button.id,
          );
        } else {
          // アクション定義がない場合は仮の定義を使って直接記録
          const fakeAction: ActionDefinition = {
            action: actionName,
            types: [],
            results: [],
            groups: [],
          };
          // 置換後のボタン名と色を渡してリンク比較・記録に使用
          handleActionClick(
            teamName,
            fakeAction,
            buttonName,
            buttonColor,
            button.id,
          );
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
        const labelValue = button.labelValue;

        // ラベルボタンを1秒間アクティブ表示
        setActiveLabelButtons((prev) => ({ ...prev, [button.id]: true }));
        setTimeout(() => {
          setActiveLabelButtons((prev) => ({ ...prev, [button.id]: false }));
        }, 1000);

        const relatedLinks = effectiveLinks.filter((link) =>
          matchesLinkTarget(link, labelButtonName, button.id),
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
                  color:
                    getButtonColorByName(targetActionName) ?? button.color,
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
              next[actionName] = {
                ...current,
                [labelButtonName]: labelValue,
              };
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
        if (newlyStarted.length === 0) {
          setWarning(null);
        }
      }
    },
    [
      activeActions,
      activeMode,
      activeRecordingsRef,
      completeRecording,
      effectiveLinks,
      getButtonColorByName,
      getCurrentTime,
      handleActionClick,
      handleApplyLabel,
      isSameActionName,
      matchesLinkTarget,
      resolveRecordingKey,
      setActiveLabelButtons,
      setActiveRecordings,
      setPrimaryAction,
      setWarning,
      teamContext,
      teamNames,
      updateLabelSelections,
    ],
  );

  return {
    handleActionClick,
    handleLabelSelect,
    handleCustomButtonClick,
    getActionLabels,
  };
};
