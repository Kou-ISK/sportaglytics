import React from 'react';
import { Box, Divider, Stack, Typography, alpha } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import TimelineIcon from '@mui/icons-material/Timeline';
import BarChartIcon from '@mui/icons-material/BarChart';

interface WelcomeHeaderProps {
  show: boolean;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({ show }) => {
  if (!show) return null;

  return (
    <>
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography
          variant="h3"
          fontWeight="bold"
          gutterBottom
          sx={{
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #1E90FF 30%, #00FF85 90%)'
                : 'linear-gradient(45deg, #1E90FF 30%, #00CED1 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SporTagLytics
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          映像分析を効率化する、プロフェッショナルなタグ付けツール
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          justifyContent="center"
          sx={{ mt: 4, mb: 2 }}
        >
          <QuickStartCard
            icon={<PlayCircleOutlineIcon sx={{ fontSize: 40 }} />}
            title="1. 映像を開く"
            description="パッケージを選択"
            color="primary"
          />
          <QuickStartCard
            icon={<TimelineIcon sx={{ fontSize: 40 }} />}
            title="2. タグ付け"
            description="プレーを記録"
            color="secondary"
          />
          <QuickStartCard
            icon={<BarChartIcon sx={{ fontSize: 40 }} />}
            title="3. 分析"
            description="統計を確認"
            color="primary"
          />
        </Stack>
      </Box>

      <Divider />
    </>
  );
};

interface QuickStartCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'primary' | 'secondary';
}

const QuickStartCard: React.FC<QuickStartCardProps> = ({
  icon,
  title,
  description,
  color,
}) => {
  return (
    <Box sx={{ textAlign: 'center', flex: 1, maxWidth: 200 }}>
      <Box
        sx={{
          display: 'inline-flex',
          p: 2,
          borderRadius: '50%',
          bgcolor: (theme) => alpha(theme.palette[color].main, 0.1),
          mb: 1,
          color: `${color}.main`,
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle2" fontWeight="bold">
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
};
