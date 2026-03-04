import type { PackageDatas } from '../../../../../../renderer';
import type { MetaData } from '../../../../../../types/MetaData';
import type {
  PackageLoadResult,
  WizardFormState,
  WizardSelectionState,
} from '../types';

export interface PackageAnglePayload {
  id: string;
  name: string;
  sourcePath: string;
  role?: 'primary' | 'secondary';
}

export const buildAnglePayloads = (
  selection: WizardSelectionState,
): PackageAnglePayload[] => {
  return selection.angles
    .filter((angle) => angle.filePath)
    .map((angle, index) => {
      const role: 'primary' | 'secondary' | undefined =
        index === 0 ? 'primary' : index === 1 ? 'secondary' : undefined;
      return {
        id: angle.id,
        name: angle.name.trim() || 'Angle',
        sourcePath: angle.filePath,
        role,
      };
    });
};

export const buildMetaDataConfig = (
  form: WizardFormState,
  actionNames: string[],
  anglePayloads: PackageAnglePayload[],
): MetaData => {
  return {
    tightViewPath: '',
    wideViewPath: null,
    team1Name: form.team1Name,
    team2Name: form.team2Name,
    actionList: actionNames,
    primaryAngleId: anglePayloads[0]?.id || undefined,
    secondaryAngleId: anglePayloads[1]?.id || undefined,
    angles: undefined,
  };
};

export const buildPackageLoadResult = (
  packageDatas: PackageDatas,
  selection: WizardSelectionState,
  form: WizardFormState,
): PackageLoadResult => {
  const primaryAngle = packageDatas.angles[0];
  const secondaryAngle =
    packageDatas.angles.length > 1 ? packageDatas.angles[1] : undefined;
  const videoList = [
    primaryAngle?.absolutePath,
    secondaryAngle?.absolutePath,
  ].filter(Boolean) as string[];

  return {
    videoList,
    syncData: undefined,
    timelinePath: packageDatas.timelinePath,
    metaDataConfigFilePath: packageDatas.metaDataConfigFilePath,
    packagePath: `${selection.selectedDirectory}/${form.packageName}`,
  };
};
