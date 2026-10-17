import fs from 'node:fs/promises';
import path from 'node:path';
import { writeTextFileAtomically } from './atomicTextFile';

interface MigrationLocation {
  source: string;
  revision: string;
  target: string;
}

/** Private machine-local hints; a matching package marker is still required. */
export class PackageMigrationIndex {
  private pending: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async read(): Promise<MigrationLocation[]> {
    try {
      const value: unknown = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (
        !Array.isArray(value) ||
        !value.every(
          (entry: unknown) =>
            entry !== null &&
            typeof entry === 'object' &&
            'source' in entry &&
            typeof entry.source === 'string' &&
            'revision' in entry &&
            typeof entry.revision === 'string' &&
            'target' in entry &&
            typeof entry.target === 'string',
        )
      )
        throw new Error('PACKAGE_MIGRATION_INDEX_INVALID');
      return value;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return [];
      throw error;
    }
  }

  async find(source: string, revision: string): Promise<string | undefined> {
    await this.pending;
    return (await this.read()).find(
      (entry) => entry.source === source && entry.revision === revision,
    )?.target;
  }

  remember(source: string, revision: string, target: string): Promise<void> {
    const task = this.pending
      .catch(() => undefined)
      .then(async () => {
        const entries = (await this.read()).filter(
          (entry) => entry.source !== source || entry.revision !== revision,
        );
        entries.push({ source, revision, target });
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await writeTextFileAtomically(this.file, JSON.stringify(entries));
      });
    this.pending = task.catch(() => undefined);
    return task;
  }
}
