import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyNativeResourceSet } from '../macos/native-signing.mjs';
import { PAYLOAD_FILES } from '../native-playback/manifest.mjs';
const complete = PAYLOAD_FILES.map((file) => `native-playback/${file}`);
test('outer signing preserves the exact three pre-signed native binaries', async () => {
  const config = JSON.parse(await readFile(new URL('../../electron-builder.json', import.meta.url), 'utf8'));
  const patterns = config.mac.signIgnore.map((pattern) => new RegExp(pattern));
  const ignored = (name) => patterns.some((pattern) => pattern.test(`/tmp/SporTagLytics.app/Contents/Resources/native-playback/${name}`));
  for (const name of ['NativeProductHost', 'Receiver.node', 'CommandLeft.node'])
    assert.equal(ignored(name), true, `${name} must retain its inner signature`);
  for (const name of ['Other.node', 'CommandLeft.node.extra', 'build.json'])
    assert.equal(ignored(name), false, `${name} must not be admitted by this rule`);
});
test('normal arm64 package requires every native resource, including an entirely missing directory', () => {
  assert.doesNotThrow(() => verifyNativeResourceSet(complete, 'arm64'));
  assert.throws(() => verifyNativeResourceSet([], 'arm64'), /resource set/);
  assert.throws(
    () => verifyNativeResourceSet(complete.slice(1), 'arm64'),
    /resource set/,
  );
});
test('rejects unlisted resources and arm64 helpers in the Intel package', () => {
  assert.throws(
    () =>
      verifyNativeResourceSet([...complete, 'native-playback/extra'], 'arm64'),
    /resource set/,
  );
  assert.throws(() => verifyNativeResourceSet(complete, 'x64'), /resource set/);
  assert.doesNotThrow(() => verifyNativeResourceSet([], 'x64'));
});
