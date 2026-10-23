# 0073 Verified playback cache foundation

## Status

Proposed

## Date

2026-10-23

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0020](0020-verified-media-toolchain-and-process-containment.md), [0046](0046-coalesced-playback-corrections.md)

## Context

デコーダーがハードウェア経路を継続できない素材では、UIのseek制御だけで再生待ちを解消できない。派生動画は有望だが、変換負荷・追加容量が大きく、時刻や音声対応を変えると既存タグと分析を壊す。

## Decision

まず本番へ未接続のjob/policy/View基盤で、原本選択を既定とする状態遷移、全時刻/音声の検証契約、容量上限、取消と片付けの直列化を実装する。次の段階としてMain用の全体hash/保存adapterを追加し、出力proofを全体SHA-256へ結合してからjob固有directoryをatomicに公開する。大きなhashは取消可能な検証段階で行い、公開中の取消不能区間を長くしない。既存cacheと中断jobの容量を含め、別jobの自動削除やmanifest成功値だけによる再利用は行わない。

所有processは停止要求とclose確認を分け、closeまでstaging所有を維持する。停止未確認を通常失敗として片付けず、busyと終了待ちを表示する。これは終了後だけ検証・公開へ進む契約を守るためであり、強制終了や未検証の再試行へ自動昇格しない。

次に、固定VideoToolbox recipe・全field/音声packet validator・Session専用IPC・原本を変更しない停止中切替を接続する。初期接続は120秒以内のファイル全体に限定し、別encoderの診断結果から長尺での性能を推定して採用しない。Mainはpreflightを含めた全処理の終了まで所有を維持し、HW観測の切断も不合格にする。

本番採用は[再生用コピー設計のactivation gate](../playback-cache.md#cache-1-activation-gate)の後に判断する。

派生物をpackage保存形式へ混ぜず端末cacheへ隔離し、原本hash・recipe・runtimeと全列検証に合格した完成品だけを選ぶ。コピー完成で自動切替せず、停止中に明示選択し、原本へ戻れるようにする。タグ時計・同期補正・書き出し元は原本のまま維持する。

Mac主Windowには`AudioVideoTracks`だけを`enableBlinkFeatures`で指定し、native音声選択をコピー/原本の双方で読戻し照合する。[Chromium 150の定義](https://github.com/chromium/chromium/blob/150.0.7871.250/third_party/blink/renderer/platform/runtime_enabled_features.json5)ではexperimentalであるため、実機資格確認をruntime更新のgateに含める。[Electronの個別指定](https://www.electronjs.org/docs/latest/api/structures/web-preferences)を使い、全experimental機能やOSアクセス権限を一括で有効にしない。APIが利用不能・選択を書き戻せないときは複数音声の採用を拒否し続ける。

AAC先頭の複数packetにまたがるprimingは[FFmpegのsample繰越処理](https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/decode.c)に対応する状態付き検査で扱う。提示開始の厳密一致と全packet hashを維持し、範囲外を無条件に切り詰めて合格させない。

成功時の変換/全列/HW観測をMain内の上限付き証跡として保持し、diagnostic poll間隔から変換速度を推定しない。証跡を新しいIPCや保存形式へ露出させない。

保存済みreadyは明示操作で現在の原本とruntimeへ再照合し、生成と共通の全列/HW validatorを通した場合だけ再利用する。再利用は変換や公開を行わず、scratchだけを片付ける。原本と候補の全hash・全proofを再計算するため、未認証manifestのboolやhash値を実内容の証明へ昇格させない。機能検証の時間枠と生成性能を分離し、全尺再生による確認のコストを明示する。長尺の区間単位の証明・再利用は、音声境界/時刻/改変検出と容量・復旧設計が未確立のため、この短尺対応では採用しない。

MP4のstream `field_order`が欠落する場合、raw metadataを補完せず、64 packet以内のdecoded prefixからdisplay scanを仮分類する。空・混在・不正属性・診断エラーは拒否し、既知値や明示unknownをこの経路へ逃がさない。その後、生成/reuse共通の全尺input validatorが全frameの属性・時刻・終端を照合し終わるまで変換・採用を許可しない。decoded top-firstはcoded-firstの証明ではなく、根拠を別の型フィールドで保持する。既存bwdif parity=autoは全入力frameのparityが明示され一致することを前提とし、未知parityの既定推測へ依存しない。

## Consequences

通常再生への安全な接続には信頼できるvalidator、所有process/容量監視、atomic公開、起動時照合、実再生と実音声の検証が必要である。基盤の合成テストをHW効果の証拠とは扱わず、全長変換や自動有効化をこの段階で開始しない。
