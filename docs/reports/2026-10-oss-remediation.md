# OSS監査後の対処計画と受入条件

対象はv0.17.10の監査13所見。基点developは `ee66eb88472b68017d09301817ac5c2489ed6b31`、main/tagは `62277574190bd86b6de9bfb8c944ad0bf316b14b`。変更は小さいdraft PRでレビュー・検証し、未検証範囲を成功扱いしない。以下は作業計画であり、公開版の機能一覧ではない。

| 順序・対象  | 対処単位                                                      | 依存・受入条件                                                                                            | 状態                       |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| 最優先 F02  | Timeline close/quitのflush・ACK、失敗取消、atomic queue drain | 0/100/299ms、書込中、Undo、失敗、複数窓、cancel後再編集をunit/実Electronで検証。Playlist/liveの保護を保持 | 実装・Linux検証済み。最終OS CI待ち |
| F03         | 合成sample、recipe、5分のquickstart                           | 実アプリでopen→追加→編集→保存再開→MP4。私的映像・外部model不要                                            | 合成sampleのLinux実操作成功 |
| F04/F06/F07 | AI実能力、同パス更新、OS別配布の説明統一                      | sampleの入口に依存。署名済みMac/未署名Windows、別途GGUF/packの条件を明示                                  | 文書を整合。初見OS導入は未検証 |
| F01         | 素材の申告と公開根拠を区別                                    | AI生成は申告として記録。サービス・元素材・条件は推定しない。確認済みPaint/native告知を未確認へ戻さない    | 文書整備。原資料判断は残る |
| F08         | 日本語lang、既存keyboard導線確認                              | 2画面幅で操作・取消・focus復帰。支援技術/OS拡大の未実施を明記                                             | lang修正・2幅keyboard確認。支援技術は未検証 |
| F09         | 交換形式名、CSVの文字列保護                                   | 数値や保存元を変更しない。式の開始文字・改行・quote・Unicodeを回帰。表計算実機は別範囲                    | CSV/形式説明を修正。表計算実機は未検証 |
| F10         | 合成負荷harnessと測定記録                                     | 条件・件数・P50/P95・保存先を記録。Node計測をUI/4K/全OS性能へ一般化しない                                 | Node限定測定済み。GUI/長時間は未検証 |
| F11         | 初回貢献・公開診断・連絡導線                                  | 小さい課題と必要検査、ログ匿名化を案内。存在未確認の非公開窓口を捏造しない                                | 文書整備。非公開窓口の到達性は未確認 |
| F12         | Node条件と配布検証summaryの保持                               | 同版commit/tree・asset hash・署名状態を長期保存。GitHub保護設定は別判断                                   | 要約生成を実装・限定検証。次Release実証待ち |
| F05         | 最小の任意provenance設計                                      | legacyを確認済みにしない。検出元/model/候補を保存・再開・編集・Undoで保持。人確認操作の未実装を明示       | 由来保存・再開を検証。人確認操作は未提供 |
| F13         | 脅威モデル、navigation/sender境界                             | 正規文書/mainFrame、外部・子frame拒否。Help/補助窓/mediaを回帰。攻撃未再現の仮説を区別                    | Linux実Electronで境界を検証。包括的評価ではない |

## 統合と公開の境界

- 保存保護を先に検証・レビューする。sample→入口docsはリンク依存があるため順に統合する。ADR採番と共通docsは統合時に揃える。
- 各PRで型・lint・境界・必要unitを実行し、共通のbuild/Storybookとnative回帰は検証したheadを明記する。同じ機械で重いfull suite/build/Electronを重複実行しない。
- cloud Linuxの実ElectronはMac/Windows実機の代替合格ではない。テスト容器のsandbox起動制約は製品のBrowserWindow設定と区別する。
- GitHubの権限・保護設定変更、新しい署名購入、未確定素材の権利判断はこのコード変更だけで完了しない。元動画・私有packageは使用・公開しない。
- 次版の配布・署名・公証はその版の証跡が揃ってから評価する。v0.17.10の成功を変更後候補へ流用しない。

## F02のクラウド検証記録

2026-10-18、Debian 13 / Node 24.19.0 / pnpm 9.1.0 / Electron 43.5.1で`pnpm run verify`成功。Vitest 251ファイル・1,112件成功、既存のMac bookmark試験1件skip、Node配布関連95件成功。renderer/Electron型検査、lint、architecture/design-system/ADR、app/Storybook build、Main build、preload bundle/sanityも成功した。

合成データのみの`e2e-timeline-close.mjs`は、編集ACKから3ms/107ms（最初のatomic staging openとrenameより前）のClose、保留rename中の最新Undo、保存失敗取消後の再編集、複数所有元Quitの取消・再試行を実Main/preload/Renderer/ファイルで確認し、新processで再読込した。保存中の追加編集は拒否された。dirty PlaylistのQuit取消ではTimeline所有元は保存後に閉じ、Playlistが残る既存動作を確認した。残存所有元の再開・native close遅延はunitでも検査した。0/100/299msと同一tickの新規行・設定色はhook試験で確認した。

Linuxの仮想画面と明示的なtest container用起動フラグを使用した。これはMac/Windows実機、OS sandbox、停電、強制終了、署名・公証の成功を意味しない。

## 統合候補0.17.11の追加検証

検証したsourceは `4272f2460330a6a93f9cec12ef43bee4f02d3877`。このcommitは各修正PRの最新head、共通docsの競合解消、0.17.11のversion準備を含む。公開状態・配布成功は[Releases](https://github.com/Kou-ISK/sportaglytics/releases)の同版の証跡を確認し、この記録だけで公開済みとは扱わない。

- `pnpm run verify`: 264ファイル・1,213件成功、既存のMac bookmark 1件skip、Node 107件成功。型・lint・architecture・design-system・ADR・app/Storybook build成功。F05を含む実依存graphのprovenance検査もskipなし。
- Main build、preload bundle/sanity成功。同じDebian 13 / Node 24.19.0 / pnpm 9.1.0 / Electron 43.5.1で実行した。
- 実Electronの終了保存6ケース群、window security、公開合成sampleの編集・disk保存・別process再開・3秒MP4、検出由来の別process再開・keyboard表示が成功。終了保存の短い待機は実測3ms/102msで、どちらも最初のatomic staging open/rename前だった。
- dirty PlaylistのQuit取消ではTimeline所有元が保存後に閉じ、Playlistが残った。残存Timeline所有元の再開をそのnativeケースで確認したとは扱わない。
- 16 MiB（UTF-8）上限は読込と保存で共有し、上限超過時の元ファイル/編集保持・Close取消・縮小retryと、上限を継承しない交換用exportを検査した。巨大入力をnative UIで操作する検査ではない。
- 終了保存専用IPCのnative getter例外は実callbackとmock getterで再現し、3channel×5箇所の追加15回帰を含む35件成功。Windows/Macで破棄競合の実害を再現したとは扱わない。
- `pnpm audit --json`と`pnpm audit --prod --json`は全severityで0件。検査時点のdatabaseと依存範囲の結果であり、未知の脆弱性不在を保証しない。

変更は[配布証跡 #234](https://github.com/Kou-ISK/sportaglytics/pull/234)、[共有/lang #235](https://github.com/Kou-ISK/sportaglytics/pull/235)、[入口文書 #236](https://github.com/Kou-ISK/sportaglytics/pull/236)、[合成sample/測定 #237](https://github.com/Kou-ISK/sportaglytics/pull/237)、[終了保存 #238](https://github.com/Kou-ISK/sportaglytics/pull/238)、[IPC境界 #239](https://github.com/Kou-ISK/sportaglytics/pull/239)、[検出由来 #240](https://github.com/Kou-ISK/sportaglytics/pull/240)に分けてレビューした。各headのCIと、統合候補のCIは区別する。

素材の原資料、初見ユーザー評価、支援技術、表計算実機、長時間/4K/全OS性能、非公開security窓口は残る確認事項である。AI生成申告・score・由来保存を、許諾確認や人確認済み精度へ格上げしない。

## 0.17.11の正式工程停止と0.17.12の検証

[正式run 39124956385](https://github.com/Kou-ISK/sportaglytics/actions/runs/39124956385)はmain `700016d1add976ad32fbb6168763b4ce4c4db5db`を検査し、Windowsの通常/インストール後E2Eと同梱物検証は成功した。macOSでは`timeline-close`の最初の単一Window Closeがprocess終了を待って失敗し、署名・公証・公開へ進まなかった。`electron/src/main.ts`はmacOSの`window-all-closed`で終了しないため、試験の終了条件を修正する。失敗したrunは保存内容のassertに到達しておらず、保存成功・失敗の証拠とは扱わない。

0.17.12では所有元/Timelineの消滅と実diskの最終値を明示的なQuitより前にassertし、macOSのprocess継続とその後のQuit、新process再開も確認する。製品の終了動作・保存実装は変更しない。新しいPRのmacOS回帰と正式Releaseの全検証はそれぞれのrun結果で確認し、この記載だけで成功済みとは扱わない。v0.17.11タグとv0.17.10以前の公開物は維持する。
