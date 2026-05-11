import { TEAM_PLACEHOLDERS } from '../../utils/teamPlaceholder';
import type {
  AnalysisDashboardConfig,
  AnalysisDashboardWidget,
  AppSettings,
  CodeWindowLayout,
} from './coreTypes';

export const createDefaultCodeWindowLayout = (): CodeWindowLayout => {
  const canvasWidth = 360;
  const canvasHeight = 420;
  const columnWidth = 160;
  const rowHeight = 40;
  const leftX = 10;
  const gapX = 20;
  const rightX = leftX + columnWidth + gapX;
  const rows = [
    { key: 'ポゼッション', y: 10 },
    { key: 'スクラム', y: 55 },
    { key: 'ラインアウト', y: 100 },
    { key: 'キックオフ', y: 145 },
    { key: 'PK', y: 190 },
    { key: 'FK', y: 235 },
    { key: 'キック', y: 280 },
    { key: 'ショット', y: 325 },
    { key: 'トライ', y: 370 },
  ];

  const makeButtons = (placeholder: string, x: number, color: string) =>
    rows.map((row, idx) => ({
      id: `${placeholder}-${idx}`,
      type: 'action' as const,
      name: `${placeholder} ${row.key}`,
      x,
      y: row.y,
      width: columnWidth,
      height: rowHeight,
      team:
        placeholder === TEAM_PLACEHOLDERS.TEAM1
          ? ('team1' as const)
          : ('team2' as const),
      color,
      textColor: '#ffffff',
      borderRadius: 8,
      fontSize: 14,
    }));

  const team1Buttons = makeButtons(TEAM_PLACEHOLDERS.TEAM1, leftX, '#4B7BEC');
  const team2Buttons = makeButtons(TEAM_PLACEHOLDERS.TEAM2, rightX, '#E74C3C');

  return {
    id: 'default',
    name: 'デフォルト',
    canvasWidth,
    canvasHeight,
    buttons: [...team1Buttons, ...team2Buttons],
    buttonLinks: [],
    splitByTeam: true,
    team1Area: {
      x: 0,
      y: 0,
      width: canvasWidth / 2,
      height: canvasHeight,
    },
    team2Area: {
      x: canvasWidth / 2,
      y: 0,
      width: canvasWidth / 2,
      height: canvasHeight,
    },
  };
};

export const createTemplateDashboardWidgets = (): AnalysisDashboardWidget[] => {
  const widgets: AnalysisDashboardWidget[] = [
    {
      id: 'template-possession',
      title: 'ポゼッション割合',
      chartType: 'pie',
      metric: 'duration',
      primaryAxis: { type: 'team' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionResult' },
      colSpan: 12,
      calc: 'percentTotal',
      widgetFilters: { action: 'ポゼッション' },
    },
  ];

  const actions = ['スクラム', 'ラインアウト', 'キック', 'FK', 'PK'];
  actions.forEach((action) => {
    widgets.push({
      id: `template-${action}-result-team1`,
      title: `${TEAM_PLACEHOLDERS.TEAM1} ${action} 結果内訳`,
      chartType: 'pie',
      metric: 'count',
      primaryAxis: { type: 'group', value: 'actionResult' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionResult' },
      colSpan: 6,
      calc: 'percentTotal',
      widgetFilters: { action, teamRole: 'team1' },
    });
    widgets.push({
      id: `template-${action}-result-team2`,
      title: `${TEAM_PLACEHOLDERS.TEAM2} ${action} 結果内訳`,
      chartType: 'pie',
      metric: 'count',
      primaryAxis: { type: 'group', value: 'actionResult' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionResult' },
      colSpan: 6,
      calc: 'percentTotal',
      widgetFilters: { action, teamRole: 'team2' },
    });
    widgets.push({
      id: `template-${action}-type-team1`,
      title: `${TEAM_PLACEHOLDERS.TEAM1} ${action} 種別内訳`,
      chartType: 'pie',
      metric: 'count',
      primaryAxis: { type: 'group', value: 'actionType' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionType' },
      colSpan: 6,
      calc: 'percentTotal',
      widgetFilters: { action, teamRole: 'team1' },
    });
    widgets.push({
      id: `template-${action}-type-team2`,
      title: `${TEAM_PLACEHOLDERS.TEAM2} ${action} 種別内訳`,
      chartType: 'pie',
      metric: 'count',
      primaryAxis: { type: 'group', value: 'actionType' },
      seriesEnabled: false,
      seriesAxis: { type: 'group', value: 'actionType' },
      colSpan: 6,
      calc: 'percentTotal',
      widgetFilters: { action, teamRole: 'team2' },
    });
  });

  return widgets;
};

export const createDefaultAnalysisDashboard = (): AnalysisDashboardConfig => ({
  dashboards: [
    {
      id: 'template-basic',
      name: '基本分析テンプレート',
      widgets: createTemplateDashboardWidgets(),
    },
  ],
  activeDashboardId: 'template-basic',
});

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  hotkeys: [
    { id: 'resync-audio', label: '音声同期を再実行', key: 'Command+Shift+S' },
    { id: 'reset-sync', label: '同期をリセット', key: 'Command+Shift+R' },
    { id: 'manual-sync', label: '今の位置で同期', key: 'Command+Shift+M' },
    {
      id: 'toggle-manual-mode',
      label: '手動モード切替',
      key: 'Command+Shift+T',
    },
    { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
    { id: 'undo', label: '元に戻す', key: 'Command+Z' },
    { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
    { id: 'skip-forward-small', label: '0.5倍速再生', key: 'Right' },
    { id: 'skip-forward-medium', label: '2倍速再生', key: 'Shift+Right' },
    { id: 'skip-forward-large', label: '4倍速再生', key: 'Command+Right' },
    { id: 'skip-forward-xlarge', label: '6倍速再生', key: 'Option+Right' },
    { id: 'skip-backward-medium', label: '5秒戻し', key: 'Left' },
    { id: 'skip-backward-large', label: '10秒戻し', key: 'Shift+Left' },
    { id: 'play-pause', label: '再生/停止', key: 'Space' },
    { id: 'toggle-angle1', label: 'アングル1切替', key: 'Shift+1' },
    { id: 'toggle-angle2', label: 'アングル2切替', key: 'Shift+2' },
  ],
  language: 'ja',
  overlayClip: {
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showMemo: true,
  },
  codingPanel: {
    defaultMode: 'code',
    toolbars: [
      {
        id: 'matrix',
        label: 'マトリクス',
        mode: 'code',
        enabled: true,
        plugin: 'matrix',
      },
      {
        id: 'script',
        label: 'スクリプト実行',
        mode: 'code',
        enabled: true,
        plugin: 'script',
      },
      {
        id: 'organizer',
        label: 'オーガナイザー',
        mode: 'label',
        enabled: true,
        plugin: 'organizer',
      },
    ],
    actionLinks: [],
    codeWindows: [createDefaultCodeWindowLayout()],
    activeCodeWindowId: 'default',
  },
  analysisDashboard: createDefaultAnalysisDashboard(),
  aiAnalysis: {
    provider: 'llama.cpp',
    baseUrl: 'http://localhost:11434',
    model: 'auto',
    temperature: 0.2,
    topK: 40,
    embeddingEnabled: false,
    teamLabelGroup: '',
    retrieverPreset: 'balanced',
  },
};
