import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const desktopReleaseNotes = ({
  includeWindows,
  installerSignatureStatus,
  version,
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
    '0.17.31では動画書き出しのオーバーレイを実フォントの文字幅で折り返すよう修正しました。明示改行と左右余白を維持し、日本語・英語・混在・長文・複数解像度で余白を残しすぎる改行を改善します。プレビューと出力は同じ配置を使い、百分率・引用符も文字として表示します。PR #288の未完成な複数映像再生は含めません。未公開0.17.30候補で見つかった保存後終了E2Eの待機条件を修正し、実file内容とMainの保存完了を確認してから通常終了します。製品の保存・終了ガードと検査期限は維持します。0.17.29では配布前のC++テスト準備を非同期化し、コンパイルと外側hookの有限期限・子の終了確認を整合させました。製品の容量・時間予算、publication安全検査、署名・公証の条件は維持します。未公開0.17.28の修正を含み、行メニューからインスタンスを選択した後にメニューのfocus復元がタイムラインのキー操作を妨げる問題を修正します。未公開0.17.27の選択同期修正も含み、独立タイムラインの複数選択が遅れた所有者同期で戻る競合を修正し、確認不明時は編集を再送せず再同期します。配布検査のバッファ復帰と明示停止・再開の計測を分離し、各フェーズと各動画の上限を検査します。未公開0.17.25のnative v2書き出しでMP4時間単位の丸めを固定誤差で拒否する問題を修正し、保存前の独立した区間検査を維持します。0.17.24で導入した有限予算の書き出し・短尺/無音素材・中止と残置通知、HTML逆再生の解除後要求を改善します。対応するApple Silicon Macの単一動画でAVPlayerの連続逆方向再生を使用し、Command＋左の解放・再押下と他の再生操作の競合を抑えます。対応条件はH.264 1080p・59.94fps・AAC 3トラックなどに限定され、非対応の素材は既存の互換経路を使用します。重い素材では開始待ちや画像更新の遅れが残ることがあります。Playlist保存中の編集や文書切替を古い保存完了で消さないようにし、埋め込み保存の指定範囲がキーフレーム位置で欠ける問題を修正します。新規埋め込みには映像と音声の再圧縮・保存時間・空き容量が必要です。以前に欠けた映像は元映像から作り直す必要があります。未完成の再生用プロキシと未公開のモデル方針は有効にしていません。実聴取同期や長時間品質、二画面境界、短尺VideoToolboxの実機受入は未完です。';
  const changes =
    version === '0.17.40'
      ? '## v0.17.39 からの変更\n- タイムラインのドラッグ中、映像の時刻丸めにより次の位置への移動が数秒待たされる問題を修正しました。2映像の同期、表示フレーム・ソースの検証は維持します。'
      : version === '0.17.38' || version === '0.17.39'
        ? [
            '## v0.17.36 からの変更',
            '- 拡張子なしの旧 SporTagLytics プロジェクトを「パッケージを開く」で選び、「.stpkg に変更」で移行できます。新しいパッケージの映像とタグを検証してから原本を復元用に退避します。同名の保存先がある場合は変換を中止します。',
            '- フォルダ形式の Sportscode パッケージ（.scpkg）から、連続映像1本と Sportscode XML を新しい .stpkg に取り込めます。XML が同梱されていない場合は、Sportscode の「File → Export → Sportscode XML」で書き出したものを選んでください。Sportscode 原本は読み取り専用です。',
            '- 独自バイナリのタイムラインの直接読込、圧縮 .sczip、複数アングルの同期の自動復元は対象外です。' +
              (version === '0.17.39'
                ? 'v0.17.37 と v0.17.38 は未配信のため、更新元は v0.17.36 です。'
                : 'v0.17.37 は未配信のため、更新元は v0.17.36 です。'),
            ...(version === '0.17.39'
              ? [
                  '- タイムラインを編集直後に閉じた場合の保存と、カメラ・マイクとネットワーク入力の同時録画を配信前に検査します。旧候補で模擬カメラの録画が停止した原因は未特定です。',
                ]
              : []),
          ].join('\n\n')
        : playbackNotes;
  return `${platformNotes} GGUFと自動検出用model packは別途必要です。FFmpeg等の対応sourceとbuild manifestは対象OS別のsource archiveに収録しています。\n\n${changes}\n`;
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
    version: process.env.RELEASE_VERSION,
    installerSignatureStatus: evidence?.installerSignatureStatus,
  });
  await mkdir('dist', { recursive: true });
  // Keep Japanese text out of shell interpolation and locale-dependent names.
  await writeFile('dist/release-notes.md', notes, 'utf8');
}
