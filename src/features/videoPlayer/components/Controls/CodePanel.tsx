import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { CodeButton } from './CodeButton';
import React, { Dispatch, SetStateAction, useEffect, useMemo } from 'react';
import { useActionPreset } from '../../../../contexts/ActionPresetContext';

interface CodePanelProps {
  metaDataConfigFilePath: string;
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
  setTeamNames: Dispatch<SetStateAction<string[]>>;
}

export const CodePanel = ({
  metaDataConfigFilePath,
  addTimelineData,
  teamNames,
  setTeamNames,
}: CodePanelProps) => {
  const { activeActions } = useActionPreset();

  useEffect(() => {
    if (!metaDataConfigFilePath) return;

    let isActive = true;

    fetch(metaDataConfigFilePath)
      .then((response) => response.json())
      .then((data) => {
        if (!isActive || !data) return;

        if (data.team1Name && data.team2Name) {
          setTeamNames([data.team1Name, data.team2Name]);
        }
      })
      .catch((error) => console.error('Error loading JSON:', error));

    return () => {
      isActive = false;
    };
  }, [metaDataConfigFilePath, setTeamNames]);

  // ActionPresetContextから取得したアクションを使用
  const actionList = useMemo(() => {
    return activeActions.map((act) => act.action);
  }, [activeActions]);

  // カテゴリでグループ化（表示には使用しない、順序保持のため）
  const groupedActions = useMemo(() => {
    return actionList.reduce<Record<string, string[]>>((groups, item) => {
      const leading = item.split(' ')[0];
      const key = leading ?? 'その他';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }, [actionList]);

  const actionGroupEntries = useMemo(
    () => Object.entries(groupedActions),
    [groupedActions],
  );

  const renderTeamColumn = (teamName: string, teamIndex: number) => (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1,
          pb: 0.5,
          borderBottom: 1,
          borderColor: teamIndex === 0 ? 'team1.main' : 'team2.main',
          color: teamIndex === 0 ? 'team1.main' : 'team2.main',
          fontWeight: 'bold',
        }}
      >
        {teamName}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 0.75,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        }}
      >
        {actionGroupEntries
          .flatMap(([, actions]) => actions)
          .map((action) => (
            <CodeButton
              key={`${teamName}-${action}`}
              actionName={`${teamName} ${action}`}
              displayName={action}
              addTimelineData={addTimelineData}
              color={teamIndex === 0 ? 'team1' : 'team2'}
            />
          ))}
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <Grid container spacing={0.5}>
        <Grid item xs={6}>
          {teamNames[0] && renderTeamColumn(teamNames[0], 0)}
        </Grid>
        <Grid item xs={6}>
          {teamNames[1] && renderTeamColumn(teamNames[1], 1)}
        </Grid>
      </Grid>
    </Box>
  );
};
