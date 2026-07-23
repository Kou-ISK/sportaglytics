import React, { useEffect, useRef } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import type { AngleSelection } from '../../types';

interface AngleSidebarProps {
  angles: AngleSelection[];
  selectedAngleId: string;
  onSelectAngle: (angleId: string) => void;
  onAddAngle: () => void;
}

export const AngleSidebar: React.FC<AngleSidebarProps> = ({
  angles,
  selectedAngleId,
  onSelectAngle,
  onAddAngle,
}) => {
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const selectedItem = selectedItemRef.current;
    if (typeof selectedItem?.scrollIntoView === 'function') {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [angles.length, selectedAngleId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        borderRight: { md: '1px solid' },
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 1 }}
      >
        <Typography variant="overline" color="text.secondary">
          アングル
        </Typography>
        <Tooltip title="アングルを追加">
          <span>
            <IconButton
              size="small"
              onClick={onAddAngle}
              disabled={angles.length >= 8}
              aria-label="アングルを追加"
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Divider />
      <List
        dense
        disablePadding
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
      >
        {angles.map((angle, index) => (
          <ListItemButton
            key={angle.id}
            ref={angle.id === selectedAngleId ? selectedItemRef : undefined}
            selected={angle.id === selectedAngleId}
            onClick={() => onSelectAngle(angle.id)}
            sx={{ py: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <VideocamOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={angle.name || `Angle ${index + 1}`}
              secondary={`${angle.clips.filter((clip) => clip.source).length}本`}
              primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
            />
            {index === 0 && (
              <Chip label="メイン" size="small" color="primary" />
            )}
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};
