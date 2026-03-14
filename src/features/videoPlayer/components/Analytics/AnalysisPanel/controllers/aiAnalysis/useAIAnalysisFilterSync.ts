import { useEffect } from 'react';

interface UseAIAnalysisFilterSyncParams {
  labelGroup: string;
  labelName: string;
  availableLabels: string[];
  setLabelName: (value: string) => void;
  teamName: string;
  availableTeamLabels: string[];
  setTeamName: (value: string) => void;
}

export const useAIAnalysisFilterSync = ({
  labelGroup,
  labelName,
  availableLabels,
  setLabelName,
  teamName,
  availableTeamLabels,
  setTeamName,
}: UseAIAnalysisFilterSyncParams) => {
  useEffect(() => {
    if (labelGroup && !availableLabels.includes(labelName)) {
      setLabelName('');
    }
  }, [availableLabels, labelGroup, labelName, setLabelName]);

  useEffect(() => {
    if (teamName && !availableTeamLabels.includes(teamName)) {
      setTeamName('');
    }
  }, [availableTeamLabels, teamName, setTeamName]);
};
