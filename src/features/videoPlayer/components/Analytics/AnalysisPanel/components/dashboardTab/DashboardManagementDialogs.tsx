import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { AnalysisDashboard } from '../../../../../../../types/settings/coreTypes';

interface DashboardManagementDialogsProps {
  isSaving: boolean;
  saveError: string | null;
  createDialogOpen: boolean;
  onCreateDialogClose: () => void;
  newDashboardName: string;
  setNewDashboardName: (value: string) => void;
  onCreateDashboard: () => Promise<void>;
  discardDialogOpen: boolean;
  onDiscardDialogClose: () => void;
  onConfirmDiscardAndSwitch: () => Promise<void>;
  deleteDialogOpen: boolean;
  onDeleteDialogClose: () => void;
  activeDashboard?: AnalysisDashboard;
  onDeleteDashboard: () => Promise<void>;
}

export const DashboardManagementDialogs = ({
  isSaving,
  saveError,
  createDialogOpen,
  onCreateDialogClose,
  newDashboardName,
  setNewDashboardName,
  onCreateDashboard,
  discardDialogOpen,
  onDiscardDialogClose,
  onConfirmDiscardAndSwitch,
  deleteDialogOpen,
  onDeleteDialogClose,
  activeDashboard,
  onDeleteDashboard,
}: DashboardManagementDialogsProps): React.JSX.Element => {
  return (
    <>
      <Dialog
        open={createDialogOpen}
        onClose={isSaving ? undefined : onCreateDialogClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>ダッシュボードを新規作成</DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {saveError}
            </Alert>
          )}
          <DialogContentText sx={{ mb: 2 }}>
            名前を入力して新しいダッシュボードを作成します。
          </DialogContentText>
          <TextField
            disabled={isSaving}
            autoFocus
            fullWidth
            size="small"
            label="ダッシュボード名"
            value={newDashboardName}
            onChange={(event) => setNewDashboardName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onCreateDashboard();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={isSaving} onClick={onCreateDialogClose}>
            キャンセル
          </Button>
          <Button
            disabled={isSaving}
            variant="contained"
            onClick={() => void onCreateDashboard()}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discardDialogOpen}
        onClose={isSaving ? undefined : onDiscardDialogClose}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>編集中の変更を破棄しますか？</DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {saveError}
            </Alert>
          )}
          <DialogContentText>
            保存していない変更は失われます。ダッシュボードを切り替えますか。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isSaving} onClick={onDiscardDialogClose}>
            キャンセル
          </Button>
          <Button
            disabled={isSaving}
            color="warning"
            variant="contained"
            onClick={() => void onConfirmDiscardAndSwitch()}
          >
            破棄して切り替え
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={isSaving ? undefined : onDeleteDialogClose}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ダッシュボードを削除</DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {saveError}
            </Alert>
          )}
          <DialogContentText>
            「{activeDashboard?.name ?? ''}
            」を削除します。この操作は元に戻せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isSaving} onClick={onDeleteDialogClose}>
            キャンセル
          </Button>
          <Button
            disabled={isSaving}
            color="error"
            variant="contained"
            onClick={() => void onDeleteDashboard()}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
