const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Electronアプリの初期化なしで実行
const userDataPath =
  process.env.HOME + '/Library/Application Support/sportaglytics';
const settingsPath = path.join(userDataPath, 'settings.json');

console.log('設定ファイルパス:', settingsPath);

if (fs.existsSync(settingsPath)) {
  fs.unlinkSync(settingsPath);
  console.log('✅ 設定ファイルを削除しました');
} else {
  console.log('ℹ️ 設定ファイルが見つかりません');
}
