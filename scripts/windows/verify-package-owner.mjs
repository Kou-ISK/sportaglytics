import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

if (process.platform !== 'win32')
  throw Error('This actual owner-identity contract requires Windows');
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'sportag-owner-contract-'));
const started = performance.now();
const failedLookup = (error) => ({
  success: false,
  elapsedMs: performance.now() - started,
  code:
    typeof error?.code === 'string' || typeof error?.code === 'number'
      ? error.code
      : null,
  signal: typeof error?.signal === 'string' ? error.signal : null,
  killed: error?.killed === true,
  stdoutBytes: typeof error?.stdout === 'string' ? Buffer.byteLength(error.stdout) : null,
  stderrBytes: typeof error?.stderr === 'string' ? Buffer.byteLength(error.stderr) : null,
  // A completed-looking stdout is diagnostic evidence only. It never grants
  // an owner identity after a failed/terminated query.
  numericStdout:
    typeof error?.stdout === 'string' && /^\d+$/.test(error.stdout.trim()),
});
try {
  let openInput;
  try {
    const value = await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Process -Id ${process.pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
      ],
      { timeout: 10000, windowsHide: true },
    );
    openInput = {
      success: true,
      elapsedMs: performance.now() - started,
      numericStdout: /^\d+$/.test(value.stdout.trim()),
    };
  } catch (error) {
    openInput = failedLookup(error);
  }
  const source = await readFile(
    new URL('../../electron/src/ipc/packageUpdateOwner.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const modulePath = join(directory, 'package-owner.cjs');
  await writeFile(modulePath, compiled, { flag: 'wx' });
  const { readProcessStartIdentity } = require(modulePath);
  const lookupStarted = performance.now();
  let closedInput;
  try {
    const identity = await readProcessStartIdentity(process.pid);
    assert.match(identity, /^\d+$/);
    closedInput = {
      success: true,
      elapsedMs: performance.now() - lookupStarted,
      numericStdout: true,
    };
  } catch (error) {
    closedInput = {
      ...failedLookup(error),
      elapsedMs: performance.now() - lookupStarted,
    };
  }
  await mkdir('output', { recursive: true });
  await writeFile(
    'output/windows-package-owner.json',
    JSON.stringify({ openInput, closedInput }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ openInput, closedInput }));
  assert.equal(closedInput.success, true, 'Actual product owner query failed');
} finally {
  await rm(directory, { recursive: true });
}
