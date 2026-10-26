import { dirname } from 'node:path';
import { verifyMacPayload } from './payload.mjs';
export default async function nativeAfterSign(context) {
  if (context.electronPlatformName !== 'darwin' || context.arch !== 3) return;
  await verifyMacPayload({
    project: context.packager.projectDir,
    app: dirname(dirname(context.packager.getResourcesDir(context.appOutDir))),
    arch: 'arm64',
    signed: true,
  });
}
