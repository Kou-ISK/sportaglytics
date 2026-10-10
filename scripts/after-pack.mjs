import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import signEventRunners from './sign-event-detection-runners-after-pack.mjs';

export default async function afterPack(context) {
  const resources = context.packager.getResourcesDir(context.appOutDir);
  for (const file of [
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'licenses/renderer.json',
    'licenses/preload.json',
  ]) {
    const text = await readFile(join(resources, file), 'utf8');
    if (!text.trim()) throw new Error(`Empty distribution notice: ${file}`);
    if (file.endsWith('.json')) {
      const entries = JSON.parse(text);
      if (
        !Array.isArray(entries) ||
        (file.includes('renderer') && entries.length === 0)
      )
        throw new Error(`Invalid distribution inventory: ${file}`);
    }
  }
  if (['darwin', 'win32'].includes(context.electronPlatformName)) {
    for (const file of [
      'ffmpeg-COPYING.LGPLv2.1',
      'freetype-LICENSE.TXT',
      'freetype-FTL.TXT',
      'harfbuzz-COPYING',
    ]) {
      if (
        !(
          await readFile(join(resources, 'media-tools/licenses', file), 'utf8')
        ).trim()
      )
        throw new Error(`Empty media notice: ${file}`);
    }
  }
  await signEventRunners(context);
}
