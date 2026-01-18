# SCTimeline形式対応 実装ドキュメント

## 概要

SporTagLyticsに、Sportscode の SCTimeline 形式のインポート/エクスポート機能を実装しました。
既存の TimelineData 構造を拡張し、完全な後方互換性を保ちながら SCTimeline との相互変換を可能にしています。

## 実装したファイル

### 1. 型定義

#### `src/types/SCTimeline.ts` (新規作成)

- **SCTimelineFile**: SCTimeline形式のルート構造
- **SCTimelineContent**: タイムライン本体
- **SCRow**: タイムライン上の行（アクション種類ごと）
- **SCInstance**: 個別のイベント
- **SCLabel**: ラベル情報（name + group）

#### `src/types/TimelineData.ts` (拡張)

- **TimelineLabel**: ラベル情報インターフェース追加
- **TimelineData.labels**: オプショナルなラベル配列を追加
  - 存在する場合: `actionType`/`actionResult` より優先
  - 存在しない場合: `actionType`/`actionResult` から自動生成

### 2. 変換ユーティリティ

#### `src/utils/scTimelineConverter.ts` (新規作成)

**主要な関数:**

1. **`convertToSCTimeline(timelineData, packagePath?)`**
   - TimelineData[] → SCTimelineFile への変換
   - actionName 別に行を自動グループ化
   - labels配列または actionType/actionResult から SCLabel を生成
   - 各行に一貫性のある色を自動割り当て

2. **`convertFromSCTimeline(scTimeline)`**
   - SCTimelineFile → TimelineData[] への変換
   - SCLabel から actionType/actionResult を抽出
   - labels配列をそのまま保持（後方互換性）
   - startTime順に自動ソート

3. **`normalizeTimelineData(data)`**
   - 古い形式のTimelineDataに labels配列を追加
   - actionType/actionResultから自動生成

4. **ヘルパー関数:**
   - `generateUUID()`: 簡易UUID生成（外部ライブラリ不要）
   - `generateColorForAction()`: アクション名に基づく色生成

### 3. インポート/エクスポート機能

#### `src/utils/timelineExport.ts` (更新)

- **`importFromJSON()`** を更新
  - labels配列が存在しない古い形式も読み込み可能
  - 読み込み時に自動的にlabels配列を生成

#### `src/pages/videoPlayer/hooks/useTimelineExportImport.ts` (更新)

**エクスポート:**

- `'sctimeline'` 形式を追加
- メニューから「SCTimeline形式」を選択可能（ファイル > エクスポート）

**インポート:**

- 従来のJSON形式の読み込み試行
- 失敗した場合、SCTimeline形式として再試行
- どちらの形式も自動判別

### 4. メニュー統合

#### `electron/src/menuBar.ts` (更新)

- ファイル > エクスポート に「SCTimeline形式」を追加
- クリック時に `'menu-export-timeline'` イベントを `'sctimeline'` パラメータで送信

## データ構造の対応関係

### SporTagLytics → SCTimeline

| SporTagLytics           | SCTimeline                                     |
| ----------------------- | ---------------------------------------------- |
| `TimelineData[]`        | `SCRow.instances[]` (actionName別にグループ化) |
| `actionName`            | `SCRow.name`                                   |
| `id`                    | `SCInstance.uniqueId`                          |
| `startTime` / `endTime` | `SCInstance.startTime` / `endTime`             |
| `qualifier`             | `SCInstance.notes`                             |
| `actionType`            | `SCLabel { name, group: "actionType" }`        |
| `actionResult`          | `SCLabel { name, group: "actionResult" }`      |
| `labels[]`              | `SCInstance.labels[]`                          |

### SCTimeline → SporTagLytics

| SCTimeline                          | SporTagLytics           |
| ----------------------------------- | ----------------------- |
| `SCRow.name`                        | `actionName`            |
| `SCInstance.uniqueId`               | `id`                    |
| `SCInstance.startTime` / `endTime`  | `startTime` / `endTime` |
| `SCInstance.notes`                  | `qualifier`             |
| `SCLabel { group: "actionType" }`   | `actionType`            |
| `SCLabel { group: "actionResult" }` | `actionResult`          |
| `SCInstance.labels[]`               | `labels[]`              |

## 後方互換性の保証

### 読み込み時

1. **古い形式（labels なし）**

   ```json
   {
     "id": "...",
     "actionName": "Pass",
     "actionType": "Short",
     "actionResult": "Won"
   }
   ```

   → `labels` 配列を自動生成:

   ```json
   {
     "labels": [
       { "name": "Short", "group": "actionType" },
       { "name": "Won", "group": "actionResult" }
     ]
   }
   ```

2. **新しい形式（labels あり）**
   ```json
   {
     "labels": [
       { "name": "Short", "group": "actionType" },
       { "name": "Won", "group": "actionResult" }
     ]
   }
   ```
   → そのまま使用

### 書き込み時

- `actionType` と `actionResult` は常に書き込まれる
- `labels` 配列も同時に書き込まれる
- 古いバージョンでも読み込み可能

## 使用方法

### エクスポート

1. メニューバー: **ファイル > エクスポート > SCTimeline形式**
2. 保存先を選択
3. `.json` 拡張子で保存（SCTimeline形式のJSON）

### インポート

1. メニューバー: **ファイル > インポート**
2. JSONファイルを選択
3. 形式を自動判別:
   - SporTagLytics形式 → そのまま読み込み
   - SCTimeline形式 → 自動変換して読み込み

### プログラムから使用

```typescript
import {
  convertToSCTimeline,
  convertFromSCTimeline,
} from '@/utils/scTimelineConverter';

// TimelineData → SCTimeline
const scTimeline = convertToSCTimeline(timelineData);
const json = JSON.stringify(scTimeline, null, 2);

// SCTimeline → TimelineData
const scTimelineData: SCTimelineFile = JSON.parse(jsonString);
const timelineData = convertFromSCTimeline(scTimelineData);
```

## SCTimeline形式の仕様

### フォーマットのバリエーション

実際のSCTimelineファイルの分析結果:

1. **labels配列**: 空の場合がある
2. **groupフィールド**: オプショナル（存在しない場合もある）
3. **packagePath**: 空文字列またはフルパス
4. **currentPlaybackTime**: ルートレベルにオプショナル

### 実装での対応

- すべてのオプショナルフィールドに対応
- groupが存在しない場合も正しく処理
- 最小限の必須フィールドのみで動作

## テスト済みのSCTimelineファイル

1. **230409 NEC 17 v 45 Canon.SCVideo/SportscodeXML.SCTimeline**
   - labels配列あり（複数のgroup）
   - 詳細な分類情報

2. **20230513 帝京v学習院vオーバー.SCVideo/SportscodeXML.SCTimeline**
   - labels配列が空
   - シンプルな構造

## 注意事項

### 制限事項

1. **行の色**
   - SCTimeline → SporTagLytics: 色情報は保持されない（表示に使用しないため）
   - SporTagLytics → SCTimeline: actionNameのハッシュ値から自動生成

2. **modifyCount / instanceNum**
   - SCTimeline → SporTagLytics: 読み捨て
   - SporTagLytics → SCTimeline: 1 または連番で生成

3. **currentPlaybackTime**
   - エクスポート時は含まれない
   - インポート時は無視される

### 推奨事項

- 既存のタイムラインデータは自動的にlabels配列が追加されるため、特別な対応は不要
- SCTimeline形式でエクスポートすると、Sportscodeで直接読み込める
- 複数のグループ情報を持つ場合は、labels配列を直接編集することを推奨

## 今後の拡張可能性

1. **追加のgroupタイプ**
   - 現在: `actionType`, `actionResult`
   - 追加可能: `Period`, `Team`, `Field Zone` など

2. **カスタムラベル**
   - UIから自由にlabelsを追加・編集
   - groupの動的な管理

3. **色の保持**
   - TimelineDataに color フィールドを追加
   - SCTimeline形式との完全な往復変換

4. **packagePath対応**
   - 動画ファイルとの関連付け
   - .SCVideoパッケージの構造対応
