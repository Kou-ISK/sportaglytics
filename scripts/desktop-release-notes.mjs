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
  const playbackNotes =
    '0.17.18は、Macの逆方向キーを離した後に遅いシーク画像へ位置が飛ぶ問題を修正します。最後に描画した画像を維持し、別操作・原本復帰・即時再押下を保持します。新しいUIや変換処理は追加しません。Apple Silicon Macの対応する単一動画のAVPlayer再生と、非対応条件の既存互換経路を維持します。押下中の0.5倍/高速逆方向の画像更新不足、停止位置の再確定に約2秒を要する限定実測、未公開Playlist候補の画像更新問題は未解決です。この修正を逆再生の滑らかさ改善とは扱いません。短い消音試験で実聴取同期や長時間品質を保証せず、原本・既存プロジェクト・公開済みv0.17.17を保持して戻せるようにします。';
  return `${platformNotes} GGUFと自動検出用model packは別途必要です。FFmpeg等の対応sourceとbuild manifestは対象OS別のsource archiveに収録しています。\n\n${playbackNotes}\n`;
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
