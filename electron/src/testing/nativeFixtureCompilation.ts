import { execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

// Fixture preparation, not an export/publication performance requirement.
const COMPILER_TIMEOUT_MS = 30_000;
export const NATIVE_FIXTURE_SETUP_TIMEOUT_MS = 35_000;

interface CompilerOutput {
  stdout: string;
  stderr: string;
}
export type NativeCompilerJob = Promise<CompilerOutput> & {
  child: ChildProcess;
};
type CompilerLauncher = (args: readonly string[]) => NativeCompilerJob;
const execFileAsync = promisify(execFile);
const launchCompiler: CompilerLauncher = (args) =>
  execFileAsync('/usr/bin/clang++', args, {
    encoding: 'utf8',
    timeout: COMPILER_TIMEOUT_MS,
    maxBuffer: 65_536,
  });

interface NativeFixturePreparation {
  ready: Promise<void>;
  canCleanup: () => boolean;
  abandon: () => void;
}

/** An outer hook timeout does not cancel pending filesystem or child work. */
export const prepareNativeFixture = (
  prepareFiles: () => Promise<readonly string[]>,
  launch: CompilerLauncher = launchCompiler,
): NativeFixturePreparation => {
  let settled = false;
  let abandoned = false;
  let childClosed = true;
  const ready = (async (): Promise<void> => {
    const args = await prepareFiles();
    if (abandoned) throw new Error('Native fixture preparation was abandoned');
    // A launcher failure cannot prove that no process was created.
    childClosed = false;
    const execution = launch(args);
    execution.child.once('close', () => {
      childClosed = true;
    });
    await execution;
    if (!childClosed)
      throw new Error('Native fixture compiler close was not confirmed');
  })().finally(() => {
    settled = true;
  });
  return {
    ready,
    canCleanup: (): boolean => settled && childClosed,
    abandon: (): void => {
      abandoned = true;
    },
  };
};
