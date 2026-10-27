import afterPack from '../after-pack.mjs';
import verifyBeforeSigning from './after-pack.mjs';
import { copyNativeResources, signNativeResources } from './native-signing.mjs';
export default async function standardAfterPack(context) {
  if (context.electronPlatformName !== 'darwin') return afterPack(context);
  if (context.arch === 3)
    await copyNativeResources(
      context.packager.projectDir,
      context.packager.getResourcesDir(context.appOutDir),
    );
  await verifyBeforeSigning(context);
  if (context.arch === 3) await signNativeResources(context);
}
