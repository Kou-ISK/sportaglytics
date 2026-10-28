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
    '0.17.19は、Macで逆方向キーを離すと開始位置へ戻り、押下中の移動要求が消える退行を修正します。キー解放で新しい要求を止め、最後に要求した位置へ移動して停止する旧操作を復元します。別操作・原本復帰・即時再押下と確認済み時刻を保持します。新しいUIや変換処理は追加しません。Apple Silicon Macの対応する単一動画のAVPlayer再生と非対応条件の既存互換経路を維持します。対象長尺素材の限定試験では0.5倍/高速逆方向の押下中に画像更新がなく、解放後は最大約2.64秒を要しました。この表示待ちと未公開Playlist候補の画像更新問題は未解決です。逆再生全体の復旧や滑らかさ改善とは扱いません。短い消音試験で実聴取同期や長時間品質を保証せず、原本・既存プロジェクト・旧Releaseを保持します。';
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
