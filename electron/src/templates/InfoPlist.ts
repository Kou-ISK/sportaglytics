/**
 * .stpkg バンドル用の Info.plist 生成テンプレート
 */

export interface PackageInfoPlistData {
  packageName: string;
  team1Name?: string;
  team2Name?: string;
  createdAt: string;
  version: string;
}

/**
 * Info.plist の XML コンテンツを生成
 * @param data パッケージメタデータ
 * @returns Info.plist の XML 文字列
 */
export function generateInfoPlist(data: PackageInfoPlistData): string {
  const displayName =
    data.team1Name && data.team2Name
      ? `${data.team1Name} vs ${data.team2Name}`
      : data.packageName;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundlePackageType</key>
    <string>BNDL</string>
    <key>CFBundleIdentifier</key>
    <string>com.kouisk.sportaglytics.stpkg.${xmlEscape(data.packageName.replace(/[^a-zA-Z0-9]/g, '_'))}</string>
    <key>CFBundleName</key>
    <string>${xmlEscape(displayName)}</string>
    <key>CFBundleDisplayName</key>
    <string>${xmlEscape(displayName)}</string>
    <key>CFBundleVersion</key>
    <string>${xmlEscape(data.version)}</string>
    <key>CFBundleShortVersionString</key>
    <string>${xmlEscape(data.version)}</string>
    <key>NSHumanReadableCopyright</key>
    <string>Created with SporTagLytics</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>SporTagLyticsCreatedAt</key>
    <string>${xmlEscape(data.createdAt)}</string>
</dict>
</plist>`;
}

/**
 * XML エスケープ処理
 * @param str エスケープ対象の文字列
 * @returns エスケープされた文字列
 */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
