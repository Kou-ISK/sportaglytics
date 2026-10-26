import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyNativeResourceSet } from '../macos/native-signing.mjs';
import { PAYLOAD_FILES } from '../native-playback/manifest.mjs';
const complete = PAYLOAD_FILES.map((file) => `native-playback/${file}`);
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
