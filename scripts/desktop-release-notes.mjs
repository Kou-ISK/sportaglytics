import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const desktopReleaseNotes = ({
  includeWindows,
  installerSignatureStatus,
}) => {
  if (typeof includeWindows !== 'boolean')
    throw Error('Expected a boolean Windows release selection');
  let platformNotes =
    'macOS arm64 / Intel 向けです。DMG内のアプリは署名・公証済みで、最終DMGから検査しています。Windows installerはこのReleaseに含みません。';
  if (includeWindows) {
    let signatureNotes;
    switch (installerSignatureStatus) {
      case 'NotSigned':
        signatureNotes = 'Windows installerは未署名です。';
        break;
      case 'Valid':
        signatureNotes = 'Windows installerのAuthenticode署名を検証済みです。';
        break;
      default:
        throw Error('Unsupported Windows installer signature status');
    }
    // The successful installed E2E job is the gate; do not duplicate its count.
    platformNotes = `macOS arm64 / Intel とWindows x64向けです。Macアプリは署名・公証済みで最終DMGから検査しています。Windowsは同じcommitから新規buildし、インストール後の全E2Eと同梱物を検査済みです。${signatureNotes}Windows Nと実カメラは未検証です。`;
  }
  return `${platformNotes} GGUFと自動検出用model packは別途必要です。FFmpeg等の対応sourceとbuild manifestは対象OS別のsource archiveに収録しています。\n`;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!['true', 'false'].includes(process.env.INCLUDE_WINDOWS))
    throw Error('Expected INCLUDE_WINDOWS=true or false');
  const includeWindows = process.env.INCLUDE_WINDOWS === 'true';
  const evidence = includeWindows
    ? JSON.parse(await readFile('dist/windows-release.json', 'utf8'))
    : undefined;
  const notes = desktopReleaseNotes({
    includeWindows,
    installerSignatureStatus: evidence?.installerSignatureStatus,
  });
  await mkdir('dist', { recursive: true });
  // Keep Japanese text out of shell interpolation and locale-dependent names.
  await writeFile('dist/release-notes.md', notes, 'utf8');
}
