# カスタムファイルアイコン実装ガイド

## 概要

SporTagLyticsでは、以下の独自ファイル形式に対してカスタムアイコンを設定しています：

- `.stpkg` - パッケージファイル（macOSバンドル形式のディレクトリ）
- `.stpl` - プレイリストファイル（JSON形式）
- `.stcw` - コードウィンドウレイアウトファイル（JSON形式）

### ファイル形式の動作

**`.stpkg` - パッケージファイル**

- 映像ファイル、タイムライン、設定を含む包括的なプロジェクトパッケージ
- macOSではバンドル（ディレクトリ）として扱われ、「パッケージの内容を表示」で内部にアクセス可能
- ダブルクリックでSporTagLyticsが起動し、パッケージが開かれる

**`.stpl` - プレイリストファイル**

- フリーズフレーム、描画、クリップ情報を保存
- ダブルクリックでSporTagLyticsが起動し、プレイリストウィンドウが開く
- JSON形式で保存（将来的に他の形式もサポート予定）

**`.stcw` - コードウィンドウファイル**

- タグ付けボタンのレイアウト設定を保存
- ダブルクリックでSporTagLyticsの設定画面が開き、コードウィンドウ編集タブで自動的にインポートされる
- JSON形式（version 1）

## アイコンファイルの構成

### 配置場所

```
public/icons/
├── stpkg.icns  # macOS用
├── stpkg.ico   # Windows用
├── stpl.icns   # macOS用
├── stpl.ico    # Windows用
├── stcw.icns   # macOS用
└── stcw.ico    # Windows用
```

### macOSアイコン（.icns）の作成

macOSのアイコンは `.iconset` フォルダから `iconutil` コマンドで生成します。

#### 必要なサイズ

`.iconset` フォルダには以下のサイズのPNGファイルが必要です：

```
icon_16x16.png       # 16x16px
icon_16x16@2x.png    # 32x32px (Retina)
icon_32x32.png       # 32x32px
icon_32x32@2x.png    # 64x64px (Retina)
icon_128x128.png     # 128x128px
icon_128x128@2x.png  # 256x256px (Retina)
icon_256x256.png     # 256x256px
icon_256x256@2x.png  # 512x512px (Retina)
icon_512x512.png     # 512x512px
icon_512x512@2x.png  # 1024x1024px (Retina)
```

#### 生成コマンド

```bash
iconutil -c icns stpkg.iconset -o public/icons/stpkg.icns
iconutil -c icns stpl.iconset -o public/icons/stpl.icns
iconutil -c icns stcw.iconset -o public/icons/stcw.icns
```

## アイコンデザインのベストプラクティス

### 余白問題の解決

スクリーンショットで見られる「黒背景の外に余白ができる」問題は、以下の原因で発生します：

1. **アルファチャンネルの不適切な使用**
   - 黒背景が不透明で、その外側に透明な余白がある
   - macOSは透明部分を余白として認識する

2. **推奨される解決方法**

#### オプション1: 完全な透明背景（推奨）

```
- 黒背景部分をアイコンの端まで広げる
- または、黒背景を削除して完全に透明背景にする
- アイコンの主要な要素（カメラなど）だけを描画
```

#### オプション2: macOS標準スタイルに合わせる

```
- 角丸の適用（macOS Big Sur以降のスタイル）
- グラデーションやシャドウの追加
- 3D効果の適用
```

### アイコン作成時の注意点

1. **透明背景を使用する**
   - PNGのアルファチャンネルで透明度を設定
   - 黒背景を使う場合は画像の端まで広げる

2. **余白は内側に確保する**
   - アイコンの主要素の周りに余白を設ける
   - 画像自体の外側に透明な余白を残さない

3. **すべてのサイズで確認する**
   - 小さいサイズ（16x16）でも認識できるデザイン
   - 大きいサイズ（1024x1024）でも粗くならない

4. **一貫性のあるデザイン**
   - 3つのファイル形式で統一感を持たせる
   - ファイル形式の違いが分かるようにする

## electron-builder設定

`electron-builder.json`で各ファイル形式を定義しています：

### fileAssociations

基本的なファイル関連付けを定義（アイコンは`extendInfo`で指定）：

```json
{
  "fileAssociations": [
    {
      "ext": "stpkg",
      "name": "SporTagLytics Package",
      "description": "SporTagLytics パッケージファイル",
      "role": "Editor",
      "isPackage": true
    },
    {
      "ext": "stpl",
      "name": "SporTagLytics Playlist",
      "description": "SporTagLytics プレイリスト",
      "role": "Viewer"
    },
    {
      "ext": "stcw",
      "name": "SporTagLytics Code Window",
      "description": "SporTagLytics コードウィンドウ",
      "role": "Viewer"
    }
  ]
}
```

### macOS固有設定（extendInfo）

UTI定義とアイコン指定：

```json
{
  "mac": {
    "extendInfo": {
      "UTExportedTypeDeclarations": [
        {
          "UTTypeIdentifier": "com.kouisk.sportaglytics.stpkg",
          "UTTypeConformsTo": ["public.data", "com.apple.package"],
          "UTTypeTagSpecification": {
            "public.filename-extension": ["stpkg"]
          }
        },
        {
          "UTTypeIdentifier": "com.kouisk.sportaglytics.stpl",
          "UTTypeConformsTo": ["public.data"],
          "UTTypeTagSpecification": {
            "public.filename-extension": ["stpl"]
          }
        },
        {
          "UTTypeIdentifier": "com.kouisk.sportaglytics.stcw",
          "UTTypeConformsTo": ["public.data"],
          "UTTypeTagSpecification": {
            "public.filename-extension": ["stcw"]
          }
        }
      ],
      "CFBundleDocumentTypes": [
        {
          "CFBundleTypeName": "SporTagLytics Package",
          "CFBundleTypeRole": "Editor",
          "CFBundleTypeIconFile": "stpkg.icns",
          "CFBundleTypeExtensions": ["stpkg"],
          "LSHandlerRank": "Owner",
          "LSItemContentTypes": ["com.kouisk.sportaglytics.stpkg"],
          "LSTypeIsPackage": true
        },
        {
          "CFBundleTypeName": "SporTagLytics Playlist",
          "CFBundleTypeRole": "Viewer",
          "CFBundleTypeIconFile": "stpl.icns",
          "CFBundleTypeExtensions": ["stpl"],
          "LSHandlerRank": "Owner",
          "LSItemContentTypes": ["com.kouisk.sportaglytics.stpl"]
        },
        {
          "CFBundleTypeName": "SporTagLytics Code Window",
          "CFBundleTypeRole": "Viewer",
          "CFBundleTypeIconFile": "stcw.icns",
          "CFBundleTypeExtensions": ["stcw"],
          "LSHandlerRank": "Owner",
          "LSItemContentTypes": ["com.kouisk.sportaglytics.stcw"]
        }
      ]
    }
  }
}
```

**重要なポイント**：

- `CFBundleTypeIconFile`と`CFBundleTypeExtensions`の両方を指定
- `LSHandlerRank: Owner`で最高優先度を設定
- stplとstcwは`public.json`を含めない（ドキュメントテンプレート適用を回避）

## アイコンの更新手順

1. **元画像の準備**
   - 1024x1024pxの高解像度PNG（透明背景）
   - 余白を内側に確保（外側は透明にしない）

2. **各サイズの生成**

   ```bash
   # ImageMagick等で各サイズを生成
   convert source.png -resize 16x16 icon_16x16.png
   convert source.png -resize 32x32 icon_16x16@2x.png
   # ... 他のサイズも同様
   ```

3. **iconsetの作成**

   ```bash
   mkdir stpkg.iconset
   # 各サイズのPNGをiconsetフォルダに配置
   ```

4. **icnsファイルの生成**

   ```bash
   iconutil -c icns stpkg.iconset -o public/icons/stpkg.icns
   ```

5. **ビルドとテスト**
   ```bash
   pnpm run build
   pnpm exec tsc -p electron
   pnpm run electron:package:mac
   # 生成された.dmgをインストールして確認
   ```

## トラブルシューティング

### アイコンが反映されない

- **開発環境では反映されません** - 必ずビルド版でテスト
- Launch Servicesのキャッシュクリア：
  ```bash
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user
  ```

### 余白が表示される

- 元画像の透明部分を確認（Photoshop等で）
- 黒背景を削除または端まで広げる
- iconutil実行前に全サイズを確認

### Windows版のアイコン

- `.ico`ファイルは複数サイズを含む単一ファイル
- オンラインツールや専用ソフトで作成
- 推奨サイズ: 16x16, 32x32, 48x48, 256x256

## 参考資料

- [Apple Human Interface Guidelines - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [electron-builder - File Associations](https://www.electron.build/configuration/configuration#PlatformSpecificBuildOptions-fileAssociations)
- [iconutil man page](https://ss64.com/osx/iconutil.html)
