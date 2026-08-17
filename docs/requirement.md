# SporTagLytics - 技術仕様書

## 1. プロジェクト概要

### 1.1 目的

スポーツ映像、特にラグビーの映像Codingと分析を効率化するdesktop application。映像中のイベントをTimelineへ記録し、ラベル、統計、プレイリスト、レポートへつなげることで、分析者が映像探索ではなく判断へ時間を使える状態を目指す。

### 1.2 対象ユーザー

- スポーツアナリスト
- コーチ・監督
- 選手
- ビデオ分析担当者

### 1.3 技術基準

| Category | Technology |
| --- | --- |
| Frontend | React 19 |
| Language | TypeScript 5.4 strict |
| Desktop | Electron 43 |
| UI | Material UI 7 |
| Video | Video.js 8 |
| Package manager | pnpm 9 |
| Build | Vite |

実装規約の正本は `AGENTS.md` とする。

---

## 2. 機能要件

## 2.1 映像再生

### マルチアングル

- 最大8アングル
- 各アングル最大16クリップ
- local video / YouTube source
- 同一アングル内でlocal/YouTubeを混在させない
- `timelineStartSeconds` をclipのglobal timeline絶対開始位置とする
- clip間空白は再生時に黒画面・無音として扱う
- 空白のための常設再生用動画は生成しない
- 旧packageはload-time migrationで現行angles/clipsへ変換する

### 同期

- local videoは音声解析による自動同期を提供する
- YouTubeを含む場合の音声補助は対応platformで表示中音声だけを一時解析する
- 手動同期を必ず残す
- angle offsetはpackage metadataへ保存する

### Playback control

- 再生/一時停止
- forward/reverse variable-speed playback
- seek
- multi-angle view切替
- 主な操作はshortcut keyを中心とする
- 再生Toolbarは補助操作とし、機能を過剰に集約しない

---

## 2.2 Code Window / Manual Coding

### Action / Label button

Code Window buttonは少なくとも次を持つ。

- action / label type
- display name
- position / size
- color / text style
- hotkey
- team/group metadata
- button link

### Recording range

Action buttonごとにSportscode型のrecording rangeを持てること。

```ts
leadTimeSeconds?: number;
lagTimeSeconds?: number;
```

UI表現:

- `開始前に含める秒数`
- `終了後に含める秒数`

挙動:

```text
finalStart = min(startPress, endPress) - lead
finalEnd   = max(startPress, endPress) + lag
```

- startは0未満にしない
- media durationが既知ならendをduration以内にclamp可能
- field未設定のlegacy設定は0秒として従来挙動を維持
- click codingとhotkey codingで同一ロジックを使う
- recording開始時に設定値をsessionへcopyし、記録中の設定変更でrangeを変えない
- Activate link targetはsource actionと同じ確定rangeを使用する

複雑なrecording mode名は導入せず、ユーザーが前後秒数を直接設定する。

---

## 2.3 Timeline

### Data model

Current persisted format:

```text
TimelineDocument v2
├ rows[]
└ instances[]
```

`TimelineData`:

- id
- actionName
- startTime
- endTime
- memo
- labels
- color

Timelineへ追加されたeventは、manual/autodetectedを問わず同一data modelとして扱う。

### Editing

- create/update/delete
- range edit
- row create/rename/color/reorder/delete
- instance move/copy
- multi-select
- memo/label edit
- Undo/Redo
- playlist追加
- import/export

### Detached Timeline window

- package open時に専用Timeline BrowserWindowを自動表示
- playback/timeline/history authorityはmain video runtime
- Timeline windowを閉じた場合は `ウィンドウ > タイムラインを表示` で再表示
- video surface上に常設の「タイムラインを表示」buttonを置かない

### Bulk insert

複数eventを1操作で追加するAPIを持つ。

```ts
addTimelineDatas(items: NewTimelineData[]): string[]
```

自動イベント検出による多数event追加は1 history entryとし、直後なら1回のUndoでまとめて戻せること。

---

## 2.4 自動イベント検出

### 目的

自動イベント検出は戦術判断を自動化する機能ではない。映像中の明確なラグビーイベントを検出して通常Timelineを初期Codingし、その後の手動分析を早く開始できるようにする。

実作業では、少数の高Precision候補だけを自動作成するより、**実際のイベントをほぼすべて候補として出し、人間が不要候補を削除する**workflowを優先する。

### Initial target classes

優先:

1. Restart
2. Scrum
3. Lineout

`Restart` は50mキックオフ、22mドロップアウト、トライライン/ゴールラインドロップアウト等を含む。

Contract上の拡張候補:

- Maul
- Goal Kick

以下は現在のproduction対象外:

- player trackingを前提としたheatmap / width / depth
- ball tracking
- jersey/player identity
- contact pose estimation
- tackle quality / dangerous tackle自動判定
- LLM/VLMによるvisual event recognition
- ユーザー端末ごとの自動fine-tuning
- 暗黙のtraining data upload

### User flow

1. packageを開く
2. `分析 > 自動イベント検出…`
3. installed verified modelを選択
4. local video angleを選択
5. event type / Timeline action name / before-after secondsを確認
6. local detectionを実行
7. verified confidence threshold / duplicate suppressionを適用
8. candidatesを通常Timelineへ一括追加
9. false positiveを削除し、必要なら見逃しeventを追加
10. 通常のmanual edit / labeling / dashboard / playlistへ進む

専用AI Timelineやreview queueは必須としない。

### Verified-only policy

Product UIへ出るmodel/event classは最低runtime基準を満たすものだけとする。

Minimum per class:

| Metric | Requirement |
| --- | ---: |
| Recall | >= 0.95 |
| unseen evaluation matches | >= 5 |
| Precision | 0〜1の有限値として記録 |
| confidence threshold | 0〜1の有限値 |

Precisionの固定最低値や秒単位の厳密なevent onsetをruntime gateにしない。

Model packが `status: verified` を名乗るだけでは利用可能にしない。Applicationはminimum runtime metricsを再検証する。

### Product usability qualification

Modelを`verified`へ昇格する前に、別private R&D repositoryで少なくとも次を検証する。

- Recall 95% / 98% / 99%近傍でのPrecision
- false positives per match
- missed events per match
- wall-clock inference time / video minute
- AI候補の削除と見逃し追加を含むmanual edit operations
- 通常の手Codingと比較した作業時間削減

処理時間と修正時間を合わせても作業効率化にならないmodelは採用しない。

### R&D boundary

SporTagLytics public repositoryはevent modelのconsumerとする。以下は別private R&D repositoryで管理する。

- dataset discovery / preparation
- training / fine-tuning
- hard-negative mining
- model family比較
- threshold / NMS / stride探索
- validation / held-out qualification
- private source diagnostics
- model export

元動画、`.stpkg`、Timeline Coding、frames、checkpoints、runsをpublic Git repositoryへcommitしない。

### Local execution boundary

Renderer:

```text
EventDetectionDialogView
  ↑ props
useEventDetectionController
  ↓
eventDetectionGateway
  ↓
window.electronAPI.eventDetection
```

Electron:

```text
preload bridge
  ↓ typed IPC
eventDetectionHandlers
  ↓
eventDetectionManager
  ↓
verified child-process runner
```

Runner constraints:

- local execution
- `shell: false`
- finite timeout
- cancel
- bounded stderr/result output
- temporary request/result file cleanup
- runner path traversal prevention
- platform/architecture-specific runner
- SHA-256 verification before execution

ML frameworkはrunner内部のimplementation detailとし、rendererを特定runtimeへ直接依存させない。

### Detection result -> Timeline

Candidateごとに:

1. enabled eventのみ残す
2. verified confidence threshold未満を除外
3. detector rangeまたはanchor timeを取得
4. configured lead/lagを適用
5. same action nameで近接/高overlapのexisting eventをduplicateとして除外
6. `NewTimelineData`へ変換
7. bulk insert

Timelineへ入った後はmanual eventと区別しない。

---

## 2.5 分析

Analysis window:

- Dashboard
- Momentum
- Matrix / cross-tab
- AI Analysis

Dashboard/MatrixはTimeline/labelsを基礎dataとする。

AI Analysis:

- local llama.cpp
- Timeline / labels / memo / statisticsを根拠とする
- visual frameをLLMへ直接理解させる機能ではない
- automatic event detectionとは別機能

---

## 2.6 Playlist

- dedicated BrowserWindow
- Timeline selected eventsから追加
- AI Analysis suggested clipsから追加
- `.stpl` document
- reference / embedded storage
- drawing / freeze frame / memo
- clip export
- multi-window support

---

## 2.7 Import / Export

Timeline:

- JSON
- CSV
- Sportscode SCTimeline XML

Clip export:

- selected/all instances
- instance/action/combined modes
- overlay
- single/multi angle
- dedicated progress window

---

## 2.8 Settings

- theme
- hotkeys
- clip overlay
- Code Window settings
- analysis dashboard settings
- local AI analysis settings

Legacy compatible fieldはdomain typeへ残し続けずload-time normalizerで吸収する。

---

## 3. 非機能要件

## 3.1 Local-first / Privacy

- source videoをcloudへ自動uploadしない
- automatic event detectionはlocal process
- AI Analysisはlocal llama.cpp
- telemetry / cloud analyticsを前提にしない
- model training用user dataの暗黙収集を行わない

## 3.2 Security

All BrowserWindow:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- unsafe navigation/window.open拒否

IPC:

- typed explicit APIs
- sender validation
- payload guards
- generic event busをpreloadへ公開しない

External process:

- rendererから直接spawnしない
- main process manager境界
- timeout/output limits
- path/hash validation where applicable

## 3.3 Compatibility

- old package/settings/timelineはload-time migration
- saveは最新modelへ統一
- deprecated route/old duplicate implementationは残さない

## 3.4 Performance

- playback UIをheavy inferenceでblockしない
- event detectionはchild processへ分離
- inference runtimeをproduct usability benchmarkの対象にする
- Timeline high-frequency clock syncとdocument syncを分離
- bulk event追加はsingle state update

## 3.5 Quality

Required PR gate:

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

ADR変更時:

```bash
pnpm run check:adr
```

Pull request CIは `develop` を含む通常統合先で実行する。Model R&DのCIはprivate repository側で管理する。

---

## 4. 関連資料

- [ユーザーガイド](user-guide.md)
- [システム概要](system-overview.md)
- [Project Structure](project-structure.md)
- [Testing and Quality Gates](testing.md)
- [自動イベント検出](event-detection.md)
- [ADR 0021 Detached Timeline and Playback Authority](adr/0021-detached-timeline-playback-authority.md)
- [ADR 0023 External Rugby Event Model R&D Boundary](adr/0023-external-rugby-event-model-rd-boundary.md)
