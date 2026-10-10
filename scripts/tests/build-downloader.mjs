import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { Agent, createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const builderRequire = createRequire(
  require.resolve('electron-builder/package.json'),
);
const libRequire = createRequire(
  builderRequire.resolve('app-builder-lib/package.json'),
);
const getRequire = createRequire(
  libRequire.resolve('@electron/get/package.json'),
);
const { downloadElectronArtifactZip } = libRequire('./out/util/electronGet.js');
const { downloadArtifact } = libRequire('@electron/get');
const got = getRequire('got');
const execute = promisify(execFile);

const payload = Buffer.alloc(256 * 1024, 73);
const digest = createHash('sha256').update(payload).digest('hex');
const filename = 'electron-v43.5.1-linux-x64.zip';
let root;
let server;
let baseUrl;
let requests = 0;
let connections = 0;

class FixtureAgent extends Agent {
  createConnection(options, callback) {
    connections += 1;
    return super.createConnection(options, callback);
  }
}
const agent = new FixtureAgent();

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sportaglytics-build-download-'));
  server = createServer((request, response) => {
    requests += 1;
    if (request.url === '/slow') return;
    if (request.url === '/missing') {
      response.writeHead(404).end();
      return;
    }
    if (request.url === '/redirect') {
      response.writeHead(302, { location: `/fixture/${filename}` }).end();
      return;
    }
    response.writeHead(200, { 'content-length': payload.length });
    response.write(payload.subarray(0, payload.length / 2));
    setImmediate(() => response.end(payload.subarray(payload.length / 2)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

after(async () => {
  agent.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

const options = (cacheDir) => ({
  artifactName: 'electron',
  version: '43.5.1',
  platformName: 'linux',
  arch: 'x64',
  cacheDir,
  electronDownload: {
    checksums: { [filename]: digest },
    mirrorOptions: { mirror: baseUrl, customDir: 'fixture' },
    downloadOptions: { agent: { http: agent }, retry: { limit: 0 } },
  },
});

test('builder downloads verified bytes and reuses its artifact file cache', async () => {
  const config = options(path.join(root, 'builder-cache'));
  const beforeRequests = requests;
  const beforeConnections = connections;
  const downloaded = await downloadElectronArtifactZip(config);
  assert.deepEqual(await readFile(downloaded), payload);
  assert.equal(requests, beforeRequests + 1);
  assert.ok(connections > beforeConnections, 'configured HTTP agent is used');
  const cached = await downloadElectronArtifactZip(config);
  assert.deepEqual(await readFile(cached), payload);
  assert.equal(
    requests,
    beforeRequests + 1,
    'file-cache hit does not use HTTP',
  );
});

test('artifact checksum mismatch is rejected', async () => {
  await assert.rejects(
    downloadArtifact({
      artifactName: 'electron',
      version: '43.5.1',
      platform: 'linux',
      arch: 'x64',
      cacheRoot: path.join(root, 'wrong-checksum'),
      checksums: { [filename]: '0'.repeat(64) },
      mirrorOptions: { mirror: baseUrl, customDir: 'fixture' },
      downloadOptions: { agent: { http: agent }, retry: { limit: 0 } },
    }),
    /checksum/i,
  );
});

test('artifact downloader retains progress callbacks', async () => {
  let transferred = 0;
  await downloadArtifact({
    artifactName: 'electron',
    version: '43.5.1',
    platform: 'linux',
    arch: 'x64',
    cacheRoot: path.join(root, 'progress'),
    checksums: { [filename]: digest },
    mirrorOptions: { mirror: baseUrl, customDir: 'fixture' },
    downloadOptions: {
      agent: { http: agent },
      retry: { limit: 0 },
      getProgressCallback: async (progress) => {
        transferred = Math.max(transferred, progress.transferred);
      },
    },
  });
  assert.equal(transferred, payload.length);
});

test('Got retains redirects and configured agents', async () => {
  const downloaded = await got(`${baseUrl}redirect`, {
    agent: { http: agent },
    retry: { limit: 0 },
  }).buffer();
  assert.deepEqual(downloaded, payload);
});

test('Got retains request timeout and HTTP errors', async () => {
  await assert.rejects(
    got(`${baseUrl}slow`, { timeout: { request: 50 }, retry: { limit: 0 } }),
    (error) => error.name === 'TimeoutError' && error.code === 'ETIMEDOUT',
  );
  await assert.rejects(
    got(`${baseUrl}missing`, { retry: { limit: 0 } }),
    (error) => error.name === 'HTTPError' && error.response.statusCode === 404,
  );
});

for (const bypass of [false, true]) {
  test(`Electron/get proxy bootstrap retains ${bypass ? 'NO_PROXY bypass' : 'HTTP proxy routing'}`, async () => {
    const proxied = [];
    const proxy = createServer((request, response) => {
      proxied.push(request.url);
      response.writeHead(200, { 'content-length': payload.length });
      response.end(payload);
    });
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    try {
      const mirror = bypass ? baseUrl : 'http://download.invalid/';
      const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;
      const config = {
        artifactName: 'electron',
        version: '43.5.1',
        platform: 'linux',
        arch: 'x64',
        cacheRoot: path.join(root, `proxy-${bypass}`),
        checksums: { [filename]: digest },
        mirrorOptions: { mirror, customDir: 'fixture' },
        downloadOptions: { retry: { limit: 0 }, timeout: { request: 3000 } },
      };
      // Bootstrap patches global HTTP agents, so keep it in a separate process.
      const { stdout } = await execute(
        process.execPath,
        [
          '-e',
          `
        const { readFile } = require('node:fs/promises');
        const { downloadArtifact } = require(process.env.TEST_ELECTRON_GET);
        downloadArtifact(JSON.parse(process.env.TEST_DOWNLOAD_OPTIONS))
          .then(readFile)
          .then((bytes) => process.stdout.write(bytes))
          .catch((error) => { console.error(error); process.exitCode = 1; });
      `,
        ],
        {
          encoding: 'buffer',
          timeout: 10000,
          env: {
            ...process.env,
            ELECTRON_GET_USE_PROXY: '1',
            GLOBAL_AGENT_HTTP_PROXY: proxyUrl,
            GLOBAL_AGENT_HTTPS_PROXY: proxyUrl,
            GLOBAL_AGENT_NO_PROXY: bypass ? '127.0.0.1' : '',
            TEST_ELECTRON_GET: libRequire.resolve('@electron/get'),
            TEST_DOWNLOAD_OPTIONS: JSON.stringify(config),
          },
        },
      );
      assert.deepEqual(stdout, payload);
      assert.deepEqual(proxied, bypass ? [] : [`${mirror}fixture/${filename}`]);
    } finally {
      proxy.closeAllConnections();
      await new Promise((resolve) => proxy.close(resolve));
    }
  });
}

test('explicit HTTP response caching fails before any request', async () => {
  const beforeRequests = requests;
  await assert.rejects(
    async () => got(baseUrl, { cache: new Map(), retry: { limit: 0 } }),
    /HTTP response caching is disabled/,
  );
  assert.equal(requests, beforeRequests);
});

test('a hook cannot re-enable HTTP response caching', async () => {
  const beforeRequests = requests;
  await assert.rejects(
    got(baseUrl, {
      retry: { limit: 0 },
      hooks: {
        beforeRequest: [
          (config) => {
            config.cache = new Map();
          },
        ],
      },
    }),
    /HTTP response caching is disabled/,
  );
  assert.equal(requests, beforeRequests);
});
