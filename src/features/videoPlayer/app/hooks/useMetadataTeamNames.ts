import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readVideoMetadataTeamNames } from '../gateways/videoMetadataGateway';

interface UseMetadataTeamNamesParams {
  metaDataConfigFilePath: string;
  setTeamNames: Dispatch<SetStateAction<string[]>>;
}

export const useMetadataTeamNames = ({
  metaDataConfigFilePath,
  setTeamNames,
}: UseMetadataTeamNamesParams): void => {
  useEffect(() => {
    if (!metaDataConfigFilePath) {
      return;
    }

    let isActive = true;

    void readVideoMetadataTeamNames(metaDataConfigFilePath)
      .then((teamMetadata) => {
        if (!isActive || !teamMetadata) {
          return;
        }

        setTeamNames([teamMetadata.team1Name, teamMetadata.team2Name]);
      })
      .catch((error) => {
        console.error('Error loading team names from metadata:', error);
      });

    return () => {
      isActive = false;
    };
  }, [metaDataConfigFilePath, setTeamNames]);
};
