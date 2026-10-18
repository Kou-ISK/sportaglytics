# OSS監査後の対処計画と受入条件

対象はv0.17.10の監査13所見。基点developは `ee66eb88472b68017d09301817ac5c2489ed6b31`、main/tagは `62277574190bd86b6de9bfb8c944ad0bf316b14b`。変更は小さいdraft PRでレビュー・検証し、未検証範囲を成功扱いしない。以下は作業計画であり、公開版の機能一覧ではない。

| 順序・対象  | 対処単位                                                      | 依存・受入条件                                                                                            | 状態                       |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| 最優先 F02  | Timeline close/quitのflush・ACK、失敗取消、atomic queue drain | 0/100/299ms、書込中、Undo、失敗、複数窓、cancel後再編集をunit/実Electronで検証。Playlist/liveの保護を保持 | cloud検証成功、OS別CI待ち          |
| F03         | 合成sample、recipe、5分のquickstart                           | 実アプリでopen→追加→編集→保存再開→MP4。私的映像・外部model不要                                            | 独立PRで準備               |
| F04/F06/F07 | AI実能力、同パス更新、OS別配布の説明統一                      | sampleの入口に依存。署名済みMac/未署名Windows、別途GGUF/packの条件を明示                                  | 独立PRで準備               |
| F01         | 素材の申告と公開根拠を区別                                    | AI生成は申告として記録。サービス・元素材・条件は推定しない。確認済みPaint/native告知を未確認へ戻さない    | 文書整備。原資料判断は残る |
| F08         | 日本語lang、既存keyboard導線確認                              | 2画面幅で操作・取消・focus復帰。支援技術/OS拡大の未実施を明記                                             | 独立PRで準備               |
| F09         | 交換形式名、CSVの文字列保護                                   | 数値や保存元を変更しない。式の開始文字・改行・quote・Unicodeを回帰。表計算実機は別範囲                    | 独立PRで準備               |
| F10         | 合成負荷harnessと測定記録                                     | 条件・件数・P50/P95・保存先を記録。Node計測をUI/4K/全OS性能へ一般化しない                                 | sampleと同系列で準備       |
| F11         | 初回貢献・公開診断・連絡導線                                  | 小さい課題と必要検査、ログ匿名化を案内。存在未確認の非公開窓口を捏造しない                                | 文書PRで準備               |
| F12         | Node条件と配布検証summaryの保持                               | 同版commit/tree・asset hash・署名状態を長期保存。GitHub保護設定は別判断                                   | 独立PRで準備               |
| F05         | 最小の任意provenance設計                                      | legacyを確認済みにしない。検出元/model/候補を保存・再開・編集・Undoで保持。人確認操作の未実装を明示       | 後方互換PRで準備           |
| F13         | 脅威モデル、navigation/sender境界                             | 正規文書/mainFrame、外部・子frame拒否。Help/補助窓/mediaを回帰。攻撃未再現の仮説を区別                    | 独立PRで準備               |

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
