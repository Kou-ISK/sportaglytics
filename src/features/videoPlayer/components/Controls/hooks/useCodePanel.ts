import { useState, useCallback, useMemo } from 'react';
import videojs from 'video.js';
import type { ActionDefinition } from '../../../../../types/Settings';

/**
 * CodePanelの選択状態とロジックを管理するhook
 */
export const useCodePanel = (
  activeActions: ActionDefinition[],
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void,
) => {
  // 選択状態（チーム情報も含む）
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // 記録中の状態
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);

  // 現在のビデオ時間を取得
  const getCurrentTime = useCallback((): number | null => {
    type VjsNamespace = {
      getPlayer?: (id: string) =>
        | {
            currentTime?: () => number | undefined;
          }
        | undefined;
    };
    const ns = videojs as unknown as VjsNamespace;
    const player = ns.getPlayer?.('video_0');
    const currentTime = player?.currentTime?.();
    return typeof currentTime === 'number' && !Number.isNaN(currentTime)
      ? currentTime
      : null;
  }, []);

  // 現在選択中のアクション定義を取得
  const currentActionDef = useMemo(() => {
    if (!selectedAction) return null;
    return activeActions.find((act) => act.action === selectedAction) || null;
  }, [selectedAction, activeActions]);

  // 利用可能なResultリスト
  const availableResults = useMemo(() => {
    return currentActionDef?.results || [];
  }, [currentActionDef]);

  // 利用可能なTypeリスト
  const availableTypes = useMemo(() => {
    return currentActionDef?.types || [];
  }, [currentActionDef]);

  // アクション選択（チーム情報も含む）
  const handleSelectAction = useCallback((team: string, action: string) => {
    setSelectedTeam(team);
    setSelectedAction(action);
    setSelectedResult(null);
    setSelectedType(null);
  }, []);

  // Result選択
  const handleSelectResult = useCallback((result: string) => {
    setSelectedResult((prev) => (prev === result ? null : result));
  }, []);

  // Type選択
  const handleSelectType = useCallback((type: string) => {
    setSelectedType((prev) => (prev === type ? null : type));
  }, []);

  // 全てリセット
  const resetSelection = useCallback(() => {
    setSelectedTeam(null);
    setSelectedAction(null);
    setSelectedResult(null);
    setSelectedType(null);
    setIsRecording(false);
  }, []);

  // 記録を開始（開始時間を保存）
  const startRecording = useCallback(() => {
    const time = getCurrentTime();
    if (time !== null) {
      setRecordingStartTime(time);
      setIsRecording(true);
    }
  }, [getCurrentTime]);

  // 記録を完了してタイムラインに追加
  const completeRecording = useCallback(() => {
    if (!selectedAction || !selectedTeam) return;

    const endTime = getCurrentTime();
    if (endTime === null) return;

    const [begin, end] =
      endTime >= recordingStartTime
        ? [recordingStartTime, endTime]
        : [endTime, recordingStartTime];

    // actionNameにチーム名を含める
    const fullActionName = `${selectedTeam} ${selectedAction}`;

    // memoは空文字列（actionType/actionResultを個別に渡す）
    const memo = '';

    addTimelineData(
      fullActionName,
      begin,
      end,
      memo,
      selectedType || undefined,
      selectedResult || undefined,
    );

    // リセット
    resetSelection();
  }, [
    selectedTeam,
    selectedAction,
    selectedResult,
    selectedType,
    recordingStartTime,
    getCurrentTime,
    addTimelineData,
    resetSelection,
  ]);

  // ワンクリック記録（記録中でない場合は開始、記録中なら完了）
  const toggleRecording = useCallback(() => {
    if (!selectedAction || !selectedTeam) return;

    if (isRecording) {
      completeRecording();
    } else {
      startRecording();
    }
  }, [
    selectedTeam,
    selectedAction,
    isRecording,
    startRecording,
    completeRecording,
  ]);

  // アクション選択と記録トグルを同時に行う
  const handleSelectAndToggle = useCallback(
    (team: string, action: string) => {
      const isSameSelection =
        selectedTeam === team && selectedAction === action;

      if (isSameSelection) {
        // 同じアクションの場合は記録をトグル
        if (isRecording) {
          completeRecording();
        } else {
          startRecording();
        }
      } else {
        // 異なるアクションの場合は選択を変更して記録開始
        setSelectedTeam(team);
        setSelectedAction(action);
        setSelectedResult(null);
        setSelectedType(null);

        // 新しい選択で記録を開始
        const time = getCurrentTime();
        if (time !== null) {
          setRecordingStartTime(time);
          setIsRecording(true);
        }
      }
    },
    [
      selectedTeam,
      selectedAction,
      isRecording,
      getCurrentTime,
      startRecording,
      completeRecording,
    ],
  );

  // 記録可能かどうか（最低限Actionが選択されている）
  const canRecord = useMemo(() => {
    return selectedAction !== null;
  }, [selectedAction]);

  // 選択状態のサマリー
  const selectionSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedTeam) parts.push(selectedTeam);
    if (selectedAction) parts.push(selectedAction);
    if (selectedResult) parts.push(selectedResult);
    if (selectedType) parts.push(selectedType);
    return parts.join(' → ');
  }, [selectedTeam, selectedAction, selectedResult, selectedType]);

  return {
    // 選択状態
    selectedTeam,
    selectedAction,
    selectedResult,
    selectedType,
    currentActionDef,
    availableResults,
    availableTypes,

    // 記録状態
    isRecording,
    canRecord,
    selectionSummary,

    // アクション
    handleSelectAction,
    handleSelectResult,
    handleSelectType,
    resetSelection,
    toggleRecording,
    handleSelectAndToggle,
  };
};
