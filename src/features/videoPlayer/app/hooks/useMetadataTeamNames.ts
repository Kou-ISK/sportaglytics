import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UseMetadataTeamNamesParams {
  metaDataConfigFilePath: string;
  setTeamNames: Dispatch<SetStateAction<string[]>>;
}

interface TeamMetadata {
  team1Name: string;
  team2Name: string;
}

const hasTeamMetadata = (value: unknown): value is TeamMetadata => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'team1Name' in value &&
    'team2Name' in value &&
    typeof (value as { team1Name?: unknown }).team1Name === 'string' &&
    typeof (value as { team2Name?: unknown }).team2Name === 'string'
  );
};

export const useMetadataTeamNames = ({
  metaDataConfigFilePath,
  setTeamNames,
}: UseMetadataTeamNamesParams): void => {
  useEffect(() => {
    if (!metaDataConfigFilePath) {
      return;
    }

    const api = globalThis.window.electronAPI;
    if (!api?.readJsonFile) {
      return;
    }

    let isActive = true;

    void api
      .readJsonFile(metaDataConfigFilePath)
      .then((data) => {
        if (!isActive || !hasTeamMetadata(data)) {
          return;
        }

        setTeamNames([data.team1Name, data.team2Name]);
      })
      .catch((error) => {
        console.error('Error loading team names from metadata:', error);
      });

    return () => {
      isActive = false;
    };
  }, [metaDataConfigFilePath, setTeamNames]);
};
