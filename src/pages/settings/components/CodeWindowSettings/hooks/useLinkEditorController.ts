import { useCallback, useMemo, useState } from 'react';
import type { ChipProps } from '@mui/material';
import type { ActionLink } from '../../../../../types/Settings';
import type { LinkEditorProps } from '../types';
import { createLink } from '../utils';

type LinkOption = {
  value: string;
  label: string;
  group: string;
};

type LinkFormState = {
  from: string;
  to: string;
  type: ActionLink['type'];
  description: string;
};

const EMPTY_FORM: LinkFormState = {
  from: '',
  to: '',
  type: 'exclusive',
  description: '',
};

export const useLinkEditorController = ({
  links,
  onLinksChange,
  availableActions,
  availableLabelGroups,
}: LinkEditorProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ActionLink | null>(null);
  const [form, setForm] = useState<LinkFormState>(EMPTY_FORM);

  const allOptions = useMemo<LinkOption[]>(() => {
    const actionOptions = availableActions.map((action) => ({
      value: `action:${action}`,
      label: action,
      group: 'アクション',
    }));
    const labelOptions = availableLabelGroups.flatMap((group) =>
      group.options.map((option) => ({
        value: `label:${group.groupName}:${option}`,
        label: `${group.groupName}: ${option}`,
        group: 'ラベル',
      })),
    );
    return [...actionOptions, ...labelOptions];
  }, [availableActions, availableLabelGroups]);

  const openCreateDialog = useCallback(() => {
    setEditingLink(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((link: ActionLink) => {
    setEditingLink(link);
    setForm({
      from: link.from,
      to: link.to,
      type: link.type,
      description: link.description || '',
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingLink(null);
  }, []);

  const saveLink = useCallback(() => {
    if (!form.from || !form.to) return;

    if (editingLink) {
      const updatedLinks = links.map((link) =>
        link.id === editingLink.id
          ? {
              ...link,
              from: form.from,
              to: form.to,
              type: form.type,
              description: form.description || undefined,
            }
          : link,
      );
      onLinksChange(updatedLinks);
    } else {
      const newLink = createLink(form.from, form.to, form.type);
      newLink.description = form.description || undefined;
      onLinksChange([...links, newLink]);
    }

    closeDialog();
  }, [closeDialog, editingLink, form, links, onLinksChange]);

  const deleteLink = useCallback(
    (linkId: string) => {
      onLinksChange(links.filter((link) => link.id !== linkId));
    },
    [links, onLinksChange],
  );

  const updateFormFrom = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, from: value }));
  }, []);

  const updateFormTo = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, to: value }));
  }, []);

  const updateFormType = useCallback((value: ActionLink['type']) => {
    setForm((prev) => ({ ...prev, type: value }));
  }, []);

  const updateFormDescription = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, description: value }));
  }, []);

  const getLinkTypeColor = useCallback((type: ActionLink['type']): ChipProps['color'] => {
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
  }, []);

  const formatLinkTarget = useCallback((target: string) => {
    if (target.startsWith('action:')) {
      return target.replace('action:', '');
    }
    if (target.startsWith('label:')) {
      const [group, option] = target.replace('label:', '').split(':');
      return `${group}: ${option}`;
    }
    return target;
  }, []);

  return {
    allOptions,
    dialogOpen,
    editingLink,
    form,
    canSave: Boolean(form.from && form.to),
    openCreateDialog,
    openEditDialog,
    closeDialog,
    saveLink,
    deleteLink,
    updateFormFrom,
    updateFormTo,
    updateFormType,
    updateFormDescription,
    getLinkTypeColor,
    formatLinkTarget,
  };
};
