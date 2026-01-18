import React from 'react';
import { Divider, Typography } from '@mui/material';
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
    <>
      <Divider sx={{ my: 2 }}>
        <Typography variant="overline" color="text.secondary">
          最近使ったパッケージ
        </Typography>
      </Divider>

      <Grid container spacing={3}>
        {packages.map((pkg) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={pkg.path}>
            <RecentPackageCard
              package={pkg}
              onOpen={onOpen}
              onRemove={onRemove}
            />
          </Grid>
        ))}
      </Grid>
    </>
  );
};
