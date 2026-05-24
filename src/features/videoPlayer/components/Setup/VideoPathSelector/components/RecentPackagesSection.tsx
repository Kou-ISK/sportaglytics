import React from 'react';
import { Stack, Typography } from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { RecentPackageCard } from '../RecentPackageCard';
import type { RecentPackage } from '../hooks/useRecentPackages';

interface RecentPackagesSectionProps {
  packages: RecentPackage[];
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

export const RecentPackagesSection: React.FC<RecentPackagesSectionProps> = ({
  packages,
  onOpen,
  onRemove,
}) => {
  if (packages.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" color="text.secondary">
        Recent
      </Typography>

      <Grid container spacing={1.5}>
        {packages.map((pkg) => (
          <Grid item xs={12} sm={6} md={4} key={pkg.path}>
            <RecentPackageCard
              package={pkg}
              onOpen={onOpen}
              onRemove={onRemove}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};
