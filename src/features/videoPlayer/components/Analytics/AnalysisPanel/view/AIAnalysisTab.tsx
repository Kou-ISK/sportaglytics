import React, { useMemo } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import type { TimelineData } from '../../../../../../types/TimelineData';
import {
  extractActionFromActionName,
  extractTeamFromActionName,
  getLabelByGroupWithFallback,
} from '../../../../../../utils/labelExtractors';
import { AnalysisCard } from './AnalysisCard';
import { NoDataPlaceholder } from './NoDataPlaceholder';

interface AIAnalysisTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  teamNames: string[];
  emptyMessage: string;
}

const formatSeconds = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const AIAnalysisTab = ({
  hasData,
  timeline,
  teamNames,
  emptyMessage,
}: AIAnalysisTabProps) => {
  const sortedTimeline = useMemo(
    () => [...timeline].sort((a, b) => a.startTime - b.startTime),
    [timeline],
  );

  const summary = useMemo(() => {
    const totalActions = timeline.length;
    const totalDuration = timeline.reduce((sum, item) => {
      const duration = item.endTime - item.startTime;
      return sum + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
    }, 0);

    const teamStats = new Map<
      string,
      { count: number; duration: number }
    >();
    const actionCounts = new Map<string, number>();
    const resultCounts = new Map<string, number>();

    for (const item of timeline) {
      const team = extractTeamFromActionName(item.actionName);
      const action = extractActionFromActionName(item.actionName);
      const result = getLabelByGroupWithFallback(
        item,
        'actionResult',
        '未設定',
      );
      const duration = Math.max(0, item.endTime - item.startTime);

      const teamEntry = teamStats.get(team) ?? {
        count: 0,
        duration: 0,
      };
      teamEntry.count += 1;
      teamEntry.duration += duration;
      teamStats.set(team, teamEntry);

      actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
      resultCounts.set(result, (resultCounts.get(result) ?? 0) + 1);
    }

    const teamRows = Array.from(teamStats.entries())
      .map(([team, stat]) => ({
        team,
        count: stat.count,
        duration: stat.duration,
        ratio: totalActions ? (stat.count / totalActions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const topResults = Array.from(resultCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const longest = [...sortedTimeline]
      .map((item) => ({
        item,
        duration: Math.max(0, item.endTime - item.startTime),
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);

    let longestStreak = { team: '未設定', count: 0 };
    let currentTeam = '';
    let currentCount = 0;
    for (const item of sortedTimeline) {
      const team = extractTeamFromActionName(item.actionName);
      if (team === currentTeam) {
        currentCount += 1;
      } else {
        currentTeam = team;
        currentCount = 1;
      }
      if (currentCount > longestStreak.count) {
        longestStreak = { team, count: currentCount };
      }
    }

    return {
      totalActions,
      totalDuration,
      teamRows,
      topActions,
      topResults,
      longest,
      longestStreak,
    };
  }, [timeline, sortedTimeline]);

  if (!hasData || timeline.length === 0) {
    return <NoDataPlaceholder message={emptyMessage} />;
  }

  return (
    <Stack spacing={2}>
      <AnalysisCard title="AI分析（プロトタイプ）">
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            タイムラインの行動ログから自動で傾向を要約します。
            現在はルールベースの試作ですが、将来的にAIモデルで精度を高めます。
          </Typography>
          <Divider />
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
            gap={2}
          >
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                サマリー
              </Typography>
              <Typography variant="body2" color="text.secondary">
                総アクション数: {summary.totalActions}件
              </Typography>
              <Typography variant="body2" color="text.secondary">
                総時間: {formatSeconds(summary.totalDuration)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                連続最多: {summary.longestStreak.team}（
                {summary.longestStreak.count}連続）
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                チーム傾向
              </Typography>
              {summary.teamRows.map((row) => (
                <Typography
                  key={row.team}
                  variant="body2"
                  color="text.secondary"
                >
                  {row.team}: {row.count}件（{row.ratio.toFixed(1)}%）
                </Typography>
              ))}
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                上位アクション
              </Typography>
              {summary.topActions.map((row) => (
                <Typography
                  key={row.action}
                  variant="body2"
                  color="text.secondary"
                >
                  {row.action}: {row.count}件
                </Typography>
              ))}
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                結果内訳
              </Typography>
              {summary.topResults.map((row) => (
                <Typography
                  key={row.label}
                  variant="body2"
                  color="text.secondary"
                >
                  {row.label}: {row.count}件
                </Typography>
              ))}
            </Paper>
          </Box>
        </Stack>
      </AnalysisCard>

      <AnalysisCard title="注目セグメント">
        <Stack spacing={1}>
          {summary.longest.map(({ item, duration }) => (
            <Paper
              key={item.id}
              variant="outlined"
              sx={{ p: 2, borderRadius: 2 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {item.actionName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                長さ: {formatSeconds(duration)} / 開始: {formatSeconds(item.startTime)}
              </Typography>
              {item.memo && (
                <Typography variant="body2" color="text.secondary">
                  メモ: {item.memo}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      </AnalysisCard>

      <AnalysisCard title="AIの所感（プロトタイプ）">
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            - {teamNames[0] ?? 'チームA'}のアクション比率が高い場合、主導権を握っている可能性があります。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            - 結果内訳の偏りがある場合は、成功/失敗のパターンが固定化している可能性があります。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            - 長時間セグメントが集中する区間は、重要局面として映像確認を推奨します。
          </Typography>
        </Stack>
      </AnalysisCard>
    </Stack>
  );
};
