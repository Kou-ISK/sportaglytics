# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Documentation

- リリース時の `develop` から `main` への統合を PR 必須の手順として明文化

## [0.6.0] - 2026-06-15

### Added

- クリップ書き出しの進捗を専用ウィンドウで表示し、書き出し中もメインウィンドウの操作を継続できるように改善
- タイムラインで選択中のイベントを `Cmd+Shift+P` でプレイリストへ追加できるショートカットを追加
- コードウィンドウの Rugby Labels プリセットを追加

### Fixed

- Electron package にローカル GGUF model files が混入し、ASAR 制限で package 生成に失敗する問題を修正
- Timeline のコンテキストメニュー「複製」が no-op になっていた問題を修正
- クロス集計表のヘッダ/フィルタ操作でレイアウトが崩れる問題を修正
- クロス集計のフィルタ編集を「適用」操作で確定し、「閉じる」では未適用の変更を反映しないように修正
- クロス集計の合計欄から該当映像へジャンプできるように修正
- プレイリスト描画の再生中に、描画位置へ到達した瞬間にクリップ冒頭へ戻る問題を修正
- プレイリスト描画モードが「完了」前に終了してしまう問題を修正
- 単一アングルの映像書き出しでオーバーレイ高さと文字サイズが不安定になる問題を修正
- オーバーレイなしの単一アングル書き出しで stream copy を使い、品質を変えずに処理を高速化

### Security

- Dependabot / `pnpm audit` の重要通知に対応し、Electron、Vite、uuid、electron-builder、video.js、wait-on と関連 transitive dependencies を patched version に更新
- patched version が提供されていない `xlsx` を削除し、Matrix XLSX export を dependency-free な最小 OOXML writer に置換

### Documentation

- OSS 向け community health files、Issue templates、docs 索引、ADR、ドキュメント運用ガイドを追加
- README、開発ガイド、AI contributor 向け規約導線を整理
- ディレクトリ構成と新規ファイル配置判断を `docs/project-structure.md` に明文化
- ADR と Docs Impact Matrix を追加し、実装変更時のドキュメント同期ルールを制定
- 音声同期、専用ウィンドウ、タイムライン相互運用、FFmpeg 書き出し、ダッシュボード統合の ADR を追加
- テスト/品質ゲート、AI 分析 setup、分析レポート export、privacy/data handling の docs を追加し、古い開発・release 記述を同期
- ADR の採番、命名、状態変更、supersede 関係の運用ルールを明文化
- ADR ファイル名の ID 必須ルールと `check:adr` による検査を追加
- LLM model artifact の配布境界 ADR を追加し、公式 package では GGUF model files を除外する方針を明文化

## [0.5.0] - 2026-02-02

### Added

- **AI分析機能**
  - ローカルLLM（llama.cpp）による映像分析パイプライン実装
  - ハイブリッド根拠検索（テキスト・ラベル・メモ・時間・レアラベル）
  - AI応答生成（要約、仮説、根拠ハイライト、推奨クリップ）
  - モデル自動検出（`public/llama/models/`配下の.ggufファイル）
  - AI分析からのプレイリスト自動生成機能
  - llama.cppバイナリとライブラリ（macOS対応、public/llama/darwin/）
  - スポーツ非依存の質問テンプレート

### Changed

- AI分析UIレイアウトを大幅改善
  - 2カラムグリッドレイアウト（1.6fr : 1fr）に変更
  - 右ペインにスクロール機能追加（maxHeight: 100vh）
  - テキスト簡素化（「AI分析」タイトル、「実行」「プレイリスト作成」ボタン）
  - 入力フィールドを2行表示（maxRows: 2）に変更
- AI根拠選択とトークン制限を改善
- AI分析の意図とコンテキスト要約を洗練
- AI分析のグラウンディングとチーム統計を改善
- AIフローを効率化し、llama.cpp進捗ログを追加
- llama.cpp統合とグラウンディング機能を改善
- AI Chat UIを洗練し、IPCリスナーを安定化
- llama出力の安定性とAI設定UIを改善

### Fixed

- AI分析からプレイリスト作成時に映像が反映されない問題を修正
  - PlaylistContextからElectron API（`window.electronAPI.playlist.addItemToAllWindows()`）に統一
  - 各PlaylistItemに`videoSource`/`videoSource2`を正しく設定
  - TypeScript型定義を改善（renderer.d.tsにチャネル別オーバーロード追加）

## [0.4.3] - 2026-01-27

### Changed

- 分析チャートとチーム集計を改善
- .stadパッケージ設定を他のアイコンと統一

## [0.4.2] - 2026-01-27

### Changed

- ダッシュボードファイルアイコンとチャートレイアウトを修正

## [0.4.1] - 2026-01-27

### Changed

- .stadパッケージ設定を他のアイコンと統一

## [0.4.0] - 2026-01-26

### Added

- **分析専用ウィンドウ機能**
  - 統計・分析を独立ウィンドウで表示
  - メインウィンドウとの双方向同期
- **ダッシュボード機能**
  - カスタマイズ可能なウィジェットシステム
  - デフォルトテンプレートダッシュボード
  - ダッシュボードテンプレート管理
  - シリーズ比較機能
  - .stadパッケージ形式のサポート
- **カスタムチャート機能**
  - カスタム軸制御
  - カスタムバーチャート
  - カスタム円グラフ
- **表示モード機能**
  - 表示モードホットキー追加
  - 単一アングル映像のフィット表示

### Changed

- 分析パネルコンポーネントをリネーム
- StatsModalをPanelにリネーム
- 分析ビューを簡素化
- ダッシュボード制約とテーマ付きツールチップを調整
- Momentumビューを復元

## [0.3.0] - 2026-01-18

### Changed

- Electron/React/MUIなど主要依存関係を更新
- CRA由来の構成整理（web-vitals、未使用設定、webpack設定の削除）
- ESLintフラット設定に移行
- GitHub ActionsのNode/pnpmを現行に合わせて統一

## [0.2.7] - 2026-01-18

### Added

- プレイリスト書き出し中の進捗をSnackbarで表示
- プレイリスト書き出しメニューを更新
- プレイリスト描画時のテキストボックススタイルを改善
- 既存プレイリストを開いた際に描画内容もロード
- 上書き保存に対応

### Fixed

- プレイリストの冒頭フレーム戻り問題を修正
- プレイリストウィンドウの閉じる確認ダイアログを修正

### Documentation

- 実装と乖離していたドキュメントを更新

## [0.2.6] - 2026-01-15

### Added

- ファイルアイコンを適用
- プレイリストで表示するアングル切替を追加

### Changed

- タイムラインからプレイリストに映像を追加する仕様を変更
- プレイリストのパッケージ形式を変更
- 映像出力時の通し番号設定を変更
- プレイリストの映像時間表示を削除

### Fixed

- アングル切替時に描画内容が反映されない問題を修正
- プレイリスト描画時の冒頭フレーム戻り問題を修正
- 複数選択時のプレイリストからの映像出力を修正
- electron-builderから不要なアイコン参照の記載を除去

### Documentation

- プロジェクトドキュメントをOSS標準に整備

## [0.2.5] - 2026-01-12

### Fixed

- 映像出力時のフォントを修正

## [0.2.4] - 2026-01-12

### Added

- ラベルモードを追加

### Changed

- 変数名qualifierをmemoに置換

### Fixed

- 日本語の文字化けを解消

## [0.2.3] - 2026-01-11

### Added

- entitlementsファイルをresource配下に移動
- Apple Developer署名・公証を実装

### Fixed

- entitlementsファイルをpublic/ディレクトリに移動（ベストプラクティス）
- 非推奨のnotarize.teamId設定を削除（electron-builder 25.x対応）

### Changed

- 古いresources/ディレクトリを削除

## [0.2.2] - 2026-01-08

### Added

- 個別映像全画面表示機能を追加

### Fixed

- 手動同期モードの動作を修正
- sync modeの修正

## [0.2.1] - 2026-01-06

### Added

- コードウィンドウのホットキー対応と設定スキーマ移行

### Changed

- helpとREADMEを最新の仕様に合わせて更新

## [0.2.0] - 2026-01-05

### Added

#### プレイリスト機能

- プレイリスト専用ウィンドウの実装
  - 連続/ループ再生機能
  - フリーズフレーム機能
  - 簡易描画機能（矩形/円/線/矢印/テキスト）
  - デュアルビュー切替
  - メモ編集
- クリップ書き出し機能（1ファイル/インスタンスごと/アクションごと）
- PlaylistContext によるプレイリスト管理
- メイン↔プレイリストウィンドウ間の双方向IPC通信

#### コーディングパネルの大幅改修

- 自由配置エディタ（FreeCanvasEditor）の実装
  - ドラッグ&ドロップによるボタン配置
  - 複数ボタンの同時選択（Shift/Cmd+クリック）
  - グリッドスナップ
  - ボタンリンク機能（exclusive/activate/deactivate/sequence）
  - Undo/Redo機能
- コーディングパネルのモード切替と設定管理
- ホットキー対応（Delete, Cmd+X, Cmd+Shift+D）

#### タイムライン機能強化

- 範囲選択機能
- ドラッグ&ドロップによるアクションインスタンス移動
- 右クリックでタイムラインメニュー表示
- タイムラインパネルでのホットキー対応（Delete, Undo/Redo）
- タイムライン行のアクション色付け
- ラベル配列構造への対応

#### 統計・分析機能

- 分析メニューの大幅改修
- マトリクスの軸選択UI変更
- 選択中インスタンスの合計/平均時間表示

#### UX改善

- パッケージ新規作成フローの改善
- 最近開いた項目をメニューバーから開けるように変更
- アクション選択切り替えをTabで実行可能に
- スペースキーによる映像の再生停止
- UIの統一

#### その他

- 映像出力機能の追加・改善
- 複数アクションを並行で記録できるように変更
- activateされたアクションを正常に終了できない問題を解消
- ラベル付与時のdeactivateしたアクションへの対応

### Changed

- actionType, actionResultを廃止しlabels配列を使用
- 不要なメニューをタイムラインから削除
- アクション編集ダイアログのサイズ変更
- componentを小さい単位に切り出し

### Fixed

- 各種バグ修正

---

## [2.2.0] - 2025-01-01

### Fixed

#### 2つ目の映像が表示されなくなる問題

**問題**: シーク操作中に2つ目の映像が表示されなくなる、または完全に消失する問題が発生していました。

**原因**:

- プレイヤーの頻繁な再初期化による不安定化
- 不適切なVideo.js状態管理
- 過度なシーク処理
- エラーハンドリング不足

**修正内容**:

- **SyncedVideoPlayer.tsx**:
  - 強制更新の最小化（初回同期時のみ）
  - プレイヤー健全性チェック強化
  - シーク閾値を2.0秒に調整
  - 詳細ログ追加
  - 非同期シーク処理の実装
  - 待機時間を500msに延長

- **SingleVideoPlayer.tsx**:
  - プレイヤー初期化の改善
  - 破棄処理の強化（`isDisposed()` チェック）
  - メタデータ処理の改善
  - 状態確認の厳密化
  - シーク処理の最適化（1.5秒閾値）
  - ソース変更の安全性向上
  - Promiseベースの再生制御

---

## [2.1.0] - 2024-12-01

### Fixed

#### 共通シークバーのNaN表示問題

**問題**: 共通シークバーで「NaN」が表示され、操作ができない問題が発生していました。

**原因**:

- Video.js プレイヤーの初期化前の値取得
- メタデータ読み込み前での処理
- NaN値に対する不十分なチェック

**修正内容**:

- Video.js の `ready()` と `loadedmetadata` イベントの適切な活用
- 厳密な型チェック（`typeof`, `!isNaN`, 範囲検証）の実装
- フォールバック機能の追加
- 多層防護（入力→表示→操作）
- デバッグログの強化

---

## Earlier Versions

## [0.1.0] - 2025-11-18

### Changed

- build後のファイルサイズを小さくするように変更

## [0.0.1] - 2023-09-15

### Added

- 初期のCIワークフローを追加

詳細な履歴は Git コミットログを参照してください。
