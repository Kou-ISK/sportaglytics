#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const preloadPath = path.join(process.cwd(), 'build', 'electron', 'src', 'preload.js');

if (!fs.existsSync(preloadPath)) {
  console.error(`Preload bundle not found: ${preloadPath}`);
  process.exit(1);
}

const content = fs.readFileSync(preloadPath, 'utf8');

const hasSplitRequire =
  content.includes("require('./preload/") || content.includes('require("./preload/');

if (hasSplitRequire) {
  console.error(
    'Preload bundle still contains split-module require("./preload/*"). ' +
      'This breaks under sandbox=true.',
  );
  process.exit(1);
}

if (
  !content.includes('exposeInMainWorld("electronAPI"') &&
  !content.includes("exposeInMainWorld('electronAPI'")
) {
  console.error('Preload bundle does not expose window.electronAPI.');
  process.exit(1);
}

const requiredMethodNames = ['openDirectory', 'readJsonFile', 'checkFileExists'];
const missingMethods = requiredMethodNames.filter(
  (methodName) =>
    !content.includes(`${methodName}:`) && !content.includes(`${methodName} =`),
);

if (missingMethods.length > 0) {
  console.error(
    `Preload bundle is missing required electronAPI methods: ${missingMethods.join(', ')}`,
  );
  process.exit(1);
}

console.log('Preload bundle check passed');
