import type { ReactElement } from 'react';
import SelectAll from '@mui/icons-material/SelectAll';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ListItemIcon,
  Menu,
  MenuItem,
} from '@mui/material';
import type { VisualTimelineViewProps } from './VisualTimelineView';

type Props = Pick<
  VisualTimelineViewProps,
  | 'rows'
  | 'rowContextMenu'
  | 'rowsPendingDeletion'
  | 'onCloseRowContextMenu'
  | 'onEditContextRow'
  | 'onMoveSelectedRow'
  | 'onRequestDeleteRows'
  | 'onCancelDeleteRows'
  | 'onConfirmDeleteRows'
  | 'onSelectRowItems'
>;

export const TimelineRowActionsView = ({
  rows,
  rowContextMenu,
  rowsPendingDeletion,
  onCloseRowContextMenu,
  onEditContextRow,
  onMoveSelectedRow,
  onRequestDeleteRows,
  onCancelDeleteRows,
  onConfirmDeleteRows,
  onSelectRowItems,
}: Props): ReactElement => (
  <>
    <Menu
      open={rowContextMenu !== null}
      onClose={onCloseRowContextMenu}
      anchorReference="anchorPosition"
      anchorPosition={
        rowContextMenu
          ? { top: rowContextMenu.mouseY, left: rowContextMenu.mouseX }
          : undefined
      }
    >
      <MenuItem onClick={onSelectRowItems}>
        <ListItemIcon>
          <SelectAll fontSize="small" />
        </ListItemIcon>
        行内のインスタンスを選択
      </MenuItem>
      <MenuItem onClick={onEditContextRow}>
        <ListItemIcon>
          <EditOutlined fontSize="small" />
        </ListItemIcon>
        行を編集
      </MenuItem>
      <MenuItem
        onClick={() => onMoveSelectedRow(-1)}
        disabled={
          !rowContextMenu ||
          rows.findIndex((row) => row.id === rowContextMenu.rowId) <= 0
        }
      >
        <ListItemIcon>
          <KeyboardArrowUp fontSize="small" />
        </ListItemIcon>
        上へ移動
      </MenuItem>
      <MenuItem
        onClick={() => onMoveSelectedRow(1)}
        disabled={
          !rowContextMenu ||
          rows.findIndex((row) => row.id === rowContextMenu.rowId) >=
            rows.length - 1
        }
      >
        <ListItemIcon>
          <KeyboardArrowDown fontSize="small" />
        </ListItemIcon>
        下へ移動
      </MenuItem>
      <MenuItem onClick={() => onRequestDeleteRows()}>
        <ListItemIcon>
          <DeleteOutline fontSize="small" color="error" />
        </ListItemIcon>
        行を削除
      </MenuItem>
    </Menu>
    <Dialog
      open={rowsPendingDeletion.length > 0}
      onClose={onCancelDeleteRows}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        {rowsPendingDeletion.length === 1
          ? `「${rowsPendingDeletion[0]?.name}」を削除しますか？`
          : `${rowsPendingDeletion.length}行を削除しますか？`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          行に含まれるインスタンスも削除されます。この操作は取り消せません。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelDeleteRows}>キャンセル</Button>
        <Button onClick={onConfirmDeleteRows} color="error" variant="contained">
          削除
        </Button>
      </DialogActions>
    </Dialog>
  </>
);
