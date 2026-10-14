import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import afterPack from '../after-pack.mjs';
import { verifyMacPayload } from './payload.mjs';

/** Release-only hook: verify the bytes before signing or Apple submission. */
export default async function verifyBeforeSigning(context) {
  const resources = context.packager.getResourcesDir(context.appOutDir);
  const project = context.packager.projectDir;
  const arch = { 1: 'x64', 3: 'arm64' }[context.arch];
  const result = await verifyMacPayload({
    project,
    app: dirname(dirname(resources)),
    arch,
  });
  const output = join(project, 'dist', 'mac-verification');
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, `before-signing-${arch}.json`),
    JSON.stringify(result, null, 2) + '\n',
  );
  await afterPack(context);
}
