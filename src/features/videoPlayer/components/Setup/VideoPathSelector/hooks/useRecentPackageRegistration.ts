import { useCallback } from 'react';
import type { PackageLoadResult } from '../types';
import type { RecentPackage } from './useRecentPackages';
import { readPackageTeamNames } from '../gateway/packageGateway';

interface UseRecentPackageRegistrationParams {
  addRecentPackage: (packageInfo: Omit<RecentPackage, 'lastOpened'>) => void;
}

export const useRecentPackageRegistration = ({
  addRecentPackage,
}: UseRecentPackageRegistrationParams): ((
  payload: PackageLoadResult,
) => Promise<void>) =>
  useCallback(
    async ({
      metaDataConfigFilePath,
      packagePath,
      videoList,
    }: PackageLoadResult): Promise<void> => {
      if (!packagePath || !metaDataConfigFilePath) {
        return;
      }

      try {
        const teamNames = await readPackageTeamNames(metaDataConfigFilePath);
        if (!teamNames) {
          return;
        }

        addRecentPackage({
          path: packagePath,
          name: packagePath.split('/').pop() || 'Unknown',
          team1Name: teamNames.team1Name,
          team2Name: teamNames.team2Name,
          videoCount: videoList.length,
        });
      } catch (error) {
        console.error('Failed to update recent packages:', error);
      }
    },
    [addRecentPackage],
  );
