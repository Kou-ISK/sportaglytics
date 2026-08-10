import type { PackageDatas } from '../../../../../../renderer';
import type { MetaData } from '../../../../../../types/package/metadata';
import type {
  PackageLoadResult,
  WizardFormState,
  WizardSelectionState,
} from '../types';

interface PackageAnglePayload {
  id: string;
  name: string;
  clips: Array<{
    id: string;
    sourceKind: 'local' | 'youtube';
    source: string;
    gapBeforeSeconds: number;
  }>;
  role?: 'primary' | 'secondary';
}

export const buildAnglePayloads = (
  selection: WizardSelectionState,
): PackageAnglePayload[] => {
  return selection.angles
    .map((angle) => ({
      ...angle,
      clips: angle.clips.filter((clip) => clip.source.trim()),
    }))
    .filter((angle) => angle.clips.length > 0)
    .map((angle, index) => {
      const role: 'primary' | 'secondary' | undefined =
        index === 0 ? 'primary' : index === 1 ? 'secondary' : undefined;
      return {
        id: angle.id,
        name: angle.name.trim() || 'Angle',
        clips: angle.clips,
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
  packageDirectory: string,
  form: WizardFormState,
): PackageLoadResult => {
  const videoList = packageDatas.angles
    .map((angle) => angle.absolutePath)
    .filter((source) => source.trim().length > 0);

  return {
    videoList,
    syncData: undefined,
    timelinePath: packageDatas.timelinePath,
    metaDataConfigFilePath: packageDatas.metaDataConfigFilePath,
    packagePath: `${packageDirectory}/${form.packageName}`,
    mediaAngles: packageDatas.angles.map((angle, index) => ({
      id: angle.id,
      name: angle.name,
      sourceKind: angle.sourceKind,
      configIndex: index,
      clips: angle.clips.map((clip) => ({
        id: clip.id,
        sourceKind: clip.sourceKind,
        source:
          clip.sourceKind === 'youtube'
            ? (clip.sourceUrl ?? '')
            : clip.relativePath
              ? `${packageDirectory}/${form.packageName}/${clip.relativePath}`
              : '',
        gapBeforeSeconds: clip.gapBeforeSeconds,
        timelineStartSeconds: clip.timelineStartSeconds ?? 0,
        durationSeconds: clip.durationSeconds,
      })),
    })),
  };
};
