import { getFfprobePath } from '../mediaTools';
import { runMediaProcess } from './mediaProcessRunner';
import { exportAbortContext } from './exportAbortContext';
export const hasExportAudio = async (source: string): Promise<boolean> => {
  const { stdout } = await runMediaProcess(
    getFfprobePath(),
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=index',
      '-of',
      'csv=p=0',
      source,
    ],
    {
      timeoutMs: 15000,
      maxOutputBytes: 65536,
      signal: exportAbortContext.getStore(),
    },
  );
  return stdout.trim().length > 0;
};
