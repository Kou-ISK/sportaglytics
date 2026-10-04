import type { ReactElement } from 'react';
import type { PackageLoadResult } from '../VideoPathSelector/types';
import { useSportscodeImport } from './hooks/useSportscodeImport';
import { SportscodeImportView } from './SportscodeImportView';

export const SportscodeImportDialog = (props: {
  open: boolean;
  onClose: () => void;
  onImported: (value: PackageLoadResult) => void;
}): ReactElement => <SportscodeImportView {...useSportscodeImport(props)} />;
