import React from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Stack,
  Box,
  IconButton,
  alpha,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { RecentPackage } from './types';

interface RecentPackageCardProps {
  package: RecentPackage;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return new Date(timestamp).toLocaleDateString('ja-JP');
};

export const RecentPackageCard: React.FC<RecentPackageCardProps> = ({
  package: pkg,
  onOpen,
  onRemove,
}) => {
  const handleClick = () => {
    onOpen(pkg.path);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(pkg.path);
  };

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) =>
            `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
        },
      }}
    >
      <CardActionArea
        onClick={handleClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <Box
          sx={{
            p: 3,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 100,
          }}
        >
          <FolderIcon sx={{ fontSize: 56, color: 'primary.main' }} />
        </Box>

        <CardContent sx={{ flexGrow: 1, width: '100%', p: 2.5 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '3em',
              lineHeight: '1.5em',
            }}
          >
            {pkg.name}
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}
          >
            <Chip
              label={pkg.team1Name}
              size="small"
              color="error"
              sx={{
                fontSize: '0.75rem',
                maxWidth: '45%',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{ alignSelf: 'center', fontWeight: 600 }}
            >
              vs
            </Typography>
            <Chip
              label={pkg.team2Name}
              size="small"
              color="primary"
              sx={{
                fontSize: '0.75rem',
                maxWidth: '45%',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
              }}
            />
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <VideoLibraryIcon
                sx={{ fontSize: 16, color: 'text.secondary' }}
              />
              <Typography variant="body2" color="text.secondary">
                {pkg.videoCount}本の映像
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatRelativeTime(pkg.lastOpened)}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>

      <IconButton
        size="small"
        onClick={handleRemove}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
          '&:hover': {
            bgcolor: 'error.main',
            color: 'white',
          },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Card>
  );
};
