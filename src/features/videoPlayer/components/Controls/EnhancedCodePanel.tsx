import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Box } from '@mui/material';
import videojs from 'video.js';
import { useActionPreset } from '../../../../contexts/ActionPresetContext';
import type { ActionDefinition, CodeWindowLayout } from '../../../../types/Settings';
import { useSettings } from '../../../../hooks/useSettings';
import { type TeamContext } from '../../../../utils/teamPlaceholder';
import { CustomCodeLayout } from './CustomCodeLayout';
import { ActionLabelGroup } from './ActionLabelGroup';
import { DefaultCodeLayout } from './DefaultCodeLayout';
import { CodePanelModeIndicator } from './CodePanelModeIndicator';
import { buildEffectiveLinks, type EffectiveLink } from './effectiveLinks';
import { useLabelSelections } from './hooks/useLabelSelections';
import { useActiveRecordings } from './hooks/useActiveRecordings';
import { useRecordingCompletion } from './hooks/useRecordingCompletion';
import { useCodePanelSettings } from './hooks/useCodePanelSettings';
import { useCodePanelInteractions } from './hooks/useCodePanelInteractions';

interface EnhancedCodePanelProps {
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
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
        !settings.codingPanel?.codeWindows ||
        !settings.codingPanel?.activeCodeWindowId
      ) {
        return null;
      }
      return (
        settings.codingPanel.codeWindows.find(
          (l) => l.id === settings.codingPanel?.activeCodeWindowId,
        ) || null
      );
    }, [
      settings.codingPanel?.codeWindows,
      settings.codingPanel?.activeCodeWindowId,
    ]);

    const {
      activeRecordings,
      setActiveRecordings,
      activeRecordingsRef,
      primaryAction,
      setPrimaryAction,
      isSameActionName,
      resolveRecordingKey,
      isRecording,
    } = useActiveRecordings(teamNames);

    // 外部から呼び出せるメソッドを公開
    useImperativeHandle(ref, () => ({
      triggerAction: (teamName: string, actionName: string) => {
        // ホットキー経由の場合は「チーム名 アクション名」形式で飛んでくるのでプレフィックスを剥がす
        const matchingTeam = teamNames.find((t) =>
          actionName.startsWith(`${t} `),
        );
        const baseActionName =
          matchingTeam && actionName.startsWith(`${matchingTeam} `)
            ? actionName.slice(matchingTeam.length + 1)
            : actionName;

        const buttonColor = getButtonColorByName(actionName);
        const action =
          activeActions.find((a) => a.action === baseActionName) ??
          // 未定義のアクションでも記録できるようにフェイク定義を作る
          ({
            action: baseActionName,
            types: [],
            results: [],
            groups: [],
          } as ActionDefinition);

        handleActionClick(
          matchingTeam ?? teamName,
          action,
          actionName,
          buttonColor,
        );
      },
    }));

    // ラベルグループの選択状態を管理（groupName -> selected option）
    const { labelSelections, labelSelectionsRef, updateLabelSelections } =
      useLabelSelections();
    const { activeMode, setActiveMode, actionLinks } = useCodePanelSettings(
      settings.codingPanel,
    );
    const setWarning = React.useCallback((message: string | null) => {
      // Warning表示は未実装だが、将来の拡張に備えて引数を吸収
      void message;
    }, []);
    const recentActionsRef = React.useRef<string[]>([]);
    // ラベルボタンの一時的なアクティブ状態（ボタンID -> true）
    const [activeLabelButtons, setActiveLabelButtons] = React.useState<
      Record<string, boolean>
    >({});
    const layoutContainerRef = React.useRef<HTMLDivElement | null>(null);
    const [layoutContainerWidth, setLayoutContainerWidth] =
      React.useState<number>(customLayout?.canvasWidth || 0);

    // メニューからのモード切替
    React.useEffect(() => {
      if (!globalThis.window.electronAPI?.onToggleLabelMode) return;
      const handler = (checked: boolean) => {
        setActiveMode(checked ? 'label' : 'code');
      };
      globalThis.window.electronAPI.onToggleLabelMode(handler);
      return () => {
        // removeListenerは未実装だが、preloadでremoveAllListenersしているためOK
      };
    }, []);

    // メニューのチェック状態を同期
    React.useEffect(() => {
      if (globalThis.window.electronAPI?.setLabelModeChecked) {
        void globalThis.window.electronAPI.setLabelModeChecked(
          activeMode === 'label',
        );
      }
    }, [activeMode]);

    // コードウィンドウ表示領域の幅を測定してスケールを合わせる
    React.useEffect(() => {
      const updateWidth = () => {
        if (layoutContainerRef.current) {
          const width = layoutContainerRef.current.clientWidth;
          if (width) {
            setLayoutContainerWidth(width);
          }
        }
      };
      updateWidth();
      const observer = new ResizeObserver(updateWidth);
      if (layoutContainerRef.current) {
        observer.observe(layoutContainerRef.current);
      }
      return () => observer.disconnect();
    }, [customLayout?.id]);

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
    const completeRecording = useRecordingCompletion({
      addTimelineData,
      getCurrentTime,
      labelSelectionsRef,
      updateLabelSelections,
      setPrimaryAction,
      recentActionsRef,
      setActiveRecordings,
    });

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

    const effectiveLinks = React.useMemo<EffectiveLink[]>(
      () => buildEffectiveLinks(actionLinks, customLayout, teamContext),
      [actionLinks, customLayout, teamContext],
    );

    // ラベルグループのレンダリング（ネスト削減のため分離）
    const renderLabelGroup = (
      actionName: string,
      groupName: string,
      options: string[],
      isLastGroup: boolean,
    ) => {
      const selectionForAction = labelSelections[actionName] ?? {};
      return (
        <ActionLabelGroup
          groupName={groupName}
          options={options}
          selectedOption={selectionForAction[groupName]}
          isLastGroup={isLastGroup}
          onSelect={(option) => handleLabelSelect(actionName, groupName, option)}
        />
      );
    };

    const referenceTeamName = firstTeamName || teamNames[0];
    const {
      handleActionClick,
      handleLabelSelect,
      handleCustomButtonClick,
      getActionLabels,
    } = useCodePanelInteractions({
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
    });

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
        >
          <CodePanelModeIndicator activeMode={activeMode} />
        </Box>

        {customLayout ? (
          <CustomCodeLayout
            layout={customLayout}
            teamContext={teamContext}
            activeRecordings={activeRecordings}
            primaryAction={primaryAction}
            activeLabelButtons={activeLabelButtons}
            isRecording={isRecording}
            layoutContainerRef={layoutContainerRef}
            layoutContainerWidth={layoutContainerWidth}
            onButtonClick={handleCustomButtonClick}
          />
        ) : (
          // デフォルトモード
          <DefaultCodeLayout
            teamNames={teamNames}
            referenceTeamName={referenceTeamName}
            actions={activeActions}
            primaryAction={primaryAction}
            activeRecordings={activeRecordings}
            getActionLabels={getActionLabels}
            onActionClick={handleActionClick}
            renderLabelGroup={renderLabelGroup}
          />
        )}
      </Box>
    );
  },
);

EnhancedCodePanel.displayName = 'EnhancedCodePanel';
