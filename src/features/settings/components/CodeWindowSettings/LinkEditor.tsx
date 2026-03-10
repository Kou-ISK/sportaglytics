import React from 'react';
import type { LinkEditorProps } from './types';
import { LinkEditorDialog } from './LinkEditorDialog';
import { LinkEditorList } from './LinkEditorList';
import { useLinkEditorController } from './hooks/useLinkEditorController';

export const LinkEditor: React.FC<LinkEditorProps> = (props) => {
  const {
    allOptions,
    dialogOpen,
    editingLink,
    form,
    canSave,
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
  } = useLinkEditorController(props);

  return (
    <>
      <LinkEditorList
        links={props.links}
        onCreate={openCreateDialog}
        onEdit={openEditDialog}
        onDelete={deleteLink}
        formatLinkTarget={formatLinkTarget}
        getLinkTypeColor={getLinkTypeColor}
      />
      <LinkEditorDialog
        open={dialogOpen}
        editingLink={editingLink}
        allOptions={allOptions}
        formFrom={form.from}
        formTo={form.to}
        formType={form.type}
        formDescription={form.description}
        canSave={canSave}
        onClose={closeDialog}
        onSave={saveLink}
        onFormFromChange={updateFormFrom}
        onFormToChange={updateFormTo}
        onFormTypeChange={updateFormType}
        onFormDescriptionChange={updateFormDescription}
      />
    </>
  );
};
