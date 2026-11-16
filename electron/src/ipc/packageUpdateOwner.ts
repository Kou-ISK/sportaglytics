import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

/** A live but reused PID must not keep an interrupted transaction locked. */
export const readProcessStartIdentity = async (
  pid: number,
): Promise<string> => {
  if (!Number.isSafeInteger(pid) || pid < 1)
    throw new Error('PACKAGE_UPDATE_OWNER_INVALID');
  const result =
    process.platform === 'win32'
      ? await execute(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
          ],
          // Cold PowerShell startup can exceed 5s on a hosted Windows runner.
          // This bounds a read-only lookup; errors remain terminal and are not
          // interpreted as an inactive owner or retried through another path.
          { timeout: 10000, windowsHide: true },
        )
      : await execute('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], {
          timeout: 5000,
        });
  const identity = result.stdout.trim();
  if (!identity) throw new Error('PACKAGE_UPDATE_OWNER_INVALID');
  return identity;
};
