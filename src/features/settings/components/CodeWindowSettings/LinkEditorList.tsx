import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import type { ActionLink } from '../../../../types/Settings';
import { LINK_TYPE_LABELS } from './types';

interface LinkEditorListProps {
  links: ActionLink[];
  onCreate: () => void;
  onEdit: (link: ActionLink) => void;
  onDelete: (linkId: string) => void;
  formatLinkTarget: (target: string) => string;
  getLinkTypeColor: (type: ActionLink['type']) => ChipProps['color'];
}

export const LinkEditorList = ({
  links,
  onCreate,
  onEdit,
  onDelete,
  formatLinkTarget,
  getLinkTypeColor,
}: LinkEditorListProps) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            アクションリンク
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={onCreate}>
          リンクを追加
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>排他</strong>: 一方を開始すると他方を終了
          <br />
          <strong>無効化</strong>: 開始時に指定したアクションを終了
          <br />
          <strong>有効化</strong>: 開始時に指定したアクションも同時に開始
        </Typography>
      </Alert>

      {links.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          リンクがありません
        </Typography>
      ) : (
        <List>
          {links.map((link) => (
            <ListItem
              key={link.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={formatLinkTarget(link.from)}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="body2" color="text.secondary">
                      →
                    </Typography>
                    <Chip
                      label={formatLinkTarget(link.to)}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={LINK_TYPE_LABELS[link.type]}
                      size="small"
                      color={getLinkTypeColor(link.type)}
                    />
                  </Box>
                }
                secondary={link.description}
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => onEdit(link)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(link.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};
