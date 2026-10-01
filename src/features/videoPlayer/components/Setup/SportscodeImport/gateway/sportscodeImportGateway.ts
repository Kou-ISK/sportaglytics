import type { PackageDatas } from '../../../../../../renderer';
import type {
  SportscodeImportRequest,
  SportscodeXmlSource,
} from '../../../../../../shared/timeline/sportscodeImport';

const api = (): NonNullable<Window['electronAPI']> => {
  if (!window.electronAPI)
    throw new Error('Electronアプリ内で読み込んでください。');
  return window.electronAPI;
};
export const selectSportscodeXml =
  async (): Promise<SportscodeXmlSource | null> => {
    const file = await api().openFileDialog([
      { name: 'Sportscode XML edit list', extensions: ['xml'] },
    ]);
    return file ? api().readSportscodeXml(file) : null;
  };
export const createSportscodeProject = async (
  request: SportscodeImportRequest,
): Promise<PackageDatas> => api().importSportscodePackage(request);
