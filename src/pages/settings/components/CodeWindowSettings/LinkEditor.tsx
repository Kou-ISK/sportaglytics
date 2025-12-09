import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import type { ActionLink } from '../../../../types/Settings';
import { LINK_TYPE_LABELS } from './types';
import { createLink } from './utils';

interface LinkEditorProps {
  links: ActionLink[];
  onLinksChange: (links: ActionLink[]) => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
}

export const LinkEditor: React.FC<LinkEditorProps> = ({
  links,
  onLinksChange,
  availableActions,
  availableLabelGroups,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ActionLink | null>(null);
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formType, setFormType] = useState<ActionLink['type']>('exclusive');
  const [formDescription, setFormDescription] = useState('');

  // アクションとラベルの統合リスト
  const allOptions = React.useMemo(() => {
    const options: Array<{ value: string; label: string; group: string }> = [];

    availableActions.forEach((action) => {
      options.push({
        value: `action:${action}`,
        label: action,
        group: 'アクション',
      });
    });

    availableLabelGroups.forEach((group) => {
      group.options.forEach((option) => {
        options.push({
          value: `label:${group.groupName}:${option}`,
          label: `${group.groupName}: ${option}`,
          group: 'ラベル',
        });
      });
    });

    return options;
  }, [availableActions, availableLabelGroups]);

  const handleOpenDialog = useCallback((link?: ActionLink) => {
    if (link) {
      setEditingLink(link);
      setFormFrom(link.from);
      setFormTo(link.to);
      setFormType(link.type);
      setFormDescription(link.description || '');
    } else {
      setEditingLink(null);
      setFormFrom('');
      setFormTo('');
      setFormType('exclusive');
      setFormDescription('');
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingLink(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!formFrom || !formTo) return;

    if (editingLink) {
      // 更新
      const updatedLinks = links.map((l) =>
        l.id === editingLink.id
          ? {
              ...l,
              from: formFrom,
              to: formTo,
              type: formType,
              description: formDescription || undefined,
            }
          : l,
      );
      onLinksChange(updatedLinks);
    } else {
      // 新規作成
      const newLink = createLink(formFrom, formTo, formType);
      newLink.description = formDescription || undefined;
      onLinksChange([...links, newLink]);
    }

    handleCloseDialog();
  }, [
    editingLink,
    formFrom,
    formTo,
    formType,
    formDescription,
    links,
    onLinksChange,
    handleCloseDialog,
  ]);

  const handleDelete = useCallback(
    (linkId: string) => {
      onLinksChange(links.filter((l) => l.id !== linkId));
    },
    [links, onLinksChange],
  );

  const getLinkTypeColor = (type: ActionLink['type']) => {
    switch (type) {
      case 'exclusive':
        return 'error';
      case 'deactivate':
        return 'warning';
      case 'activate':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatLinkTarget = (target: string) => {
    if (target.startsWith('action:')) {
      return target.replace('action:', '');
    }
    if (target.startsWith('label:')) {
      const parts = target.replace('label:', '').split(':');
      return `${parts[0]}: ${parts[1]}`;
    }
    return target;
  };

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
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
          onClick={() => handleOpenDialog()}
        >
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
                <IconButton size="small" onClick={() => handleOpenDialog(link)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(link.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* リンク編集ダイアログ */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLink ? 'リンクを編集' : '新しいリンクを追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>リンク元</InputLabel>
              <Select
                value={formFrom}
                label="リンク元"
                onChange={(e) => setFormFrom(e.target.value)}
              >
                {allOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Typography variant="body2">
                      {option.label}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({option.group})
                      </Typography>
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>リンク先</InputLabel>
              <Select
                value={formTo}
                label="リンク先"
                onChange={(e) => setFormTo(e.target.value)}
              >
                {allOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Typography variant="body2">
                      {option.label}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({option.group})
                      </Typography>
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>リンクタイプ</InputLabel>
              <Select
                value={formType}
                label="リンクタイプ"
                onChange={(e) =>
                  setFormType(e.target.value as ActionLink['type'])
                }
              >
                <MenuItem value="exclusive">
                  {LINK_TYPE_LABELS.exclusive}
                </MenuItem>
                <MenuItem value="deactivate">
                  {LINK_TYPE_LABELS.deactivate}
                </MenuItem>
                <MenuItem value="activate">
                  {LINK_TYPE_LABELS.activate}
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="説明（任意）"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="このリンクの説明"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>キャンセル</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formFrom || !formTo}
          >
            {editingLink ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
