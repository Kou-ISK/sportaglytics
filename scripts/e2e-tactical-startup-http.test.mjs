import { describe, expect, it, vi } from 'vitest';
import {
  declaredObservedWidgets,
  IFRAME_API_URL,
  OBSERVED_WIDGET_URLS,
  inspectLoadedYouTubeBootstrap,
  isClassifiedStartupRequest,
} from './e2e-tactical-startup-http.mjs';

const [OBSERVED_WIDGET_URL, UPDATED_WIDGET_URL] = OBSERVED_WIDGET_URLS;

describe('tactical board startup HTTP boundary', () => {
  it.each([
    [{ phase: 'startup', type: 'script', url: IFRAME_API_URL }, [], true],
    [
      { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL },
      [OBSERVED_WIDGET_URL],
      true,
    ],
    [{ phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL }, [], false],
    [
      { phase: 'startup', type: 'script', url: UPDATED_WIDGET_URL },
      [UPDATED_WIDGET_URL],
      true,
    ],
    [
      { phase: 'startup', type: 'script', url: UPDATED_WIDGET_URL },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL },
      [UPDATED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: UPDATED_WIDGET_URL },
      [UPDATED_WIDGET_URL],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: 'https://example.test/model.bin',
      },
      ['https://example.test/model.bin'],
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: IFRAME_API_URL },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: OBSERVED_WIDGET_URL },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'fetch', url: OBSERVED_WIDGET_URL },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: `${OBSERVED_WIDGET_URL}?x=1` },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: OBSERVED_WIDGET_URL.replace(
          'www.youtube.com',
          'www.youtube.com.evil.test',
        ),
      },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: OBSERVED_WIDGET_URL.replace('8ab5c328', 'other'),
      },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: 'https://example.test/model.bin',
      },
      [OBSERVED_WIDGET_URL],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: IFRAME_API_URL.replace('https:', 'http:'),
      },
      [OBSERVED_WIDGET_URL],
      false,
    ],
  ])(
    'classifies only a proved exact startup script: %j',
    (request, proof, accepted) => {
      expect(Boolean(isClassifiedStartupRequest(request, proof))).toBe(
        accepted,
      );
    },
  );

  it('requires the exact widget URL as a string literal in the loaded bootstrap', () => {
    expect(
      declaredObservedWidgets(`const url = '${OBSERVED_WIDGET_URL}';`),
    ).toEqual([OBSERVED_WIDGET_URL]);
    expect(
      declaredObservedWidgets(
        `const url = "${OBSERVED_WIDGET_URL.replaceAll('/', '\\/')}";`,
      ),
    ).toEqual([OBSERVED_WIDGET_URL]);
    expect(
      declaredObservedWidgets(`const url = '${OBSERVED_WIDGET_URL}?x=1';`),
    ).toEqual([]);
    expect(
      declaredObservedWidgets(
        `const url = '${OBSERVED_WIDGET_URL.replace('8ab5c328', 'other')}';`,
      ),
    ).toEqual([]);
  });

  it('keeps proof tied to each observed version instead of approving every known widget', () => {
    expect(
      declaredObservedWidgets(`const url = '${UPDATED_WIDGET_URL}';`),
    ).toEqual([UPDATED_WIDGET_URL]);
    expect(
      declaredObservedWidgets(
        `const urls = ['${OBSERVED_WIDGET_URL}', '${UPDATED_WIDGET_URL}'];`,
      ),
    ).toEqual(OBSERVED_WIDGET_URLS);
    expect(
      declaredObservedWidgets(`const url = '${UPDATED_WIDGET_URL}?x=1';`),
    ).toEqual([]);
  });

  it('reads only the already-loaded exact bootstrap and detaches its own CDP session', async () => {
    let parsed = () => {};
    const session = {
      on: vi.fn((_event, callback) => {
        parsed = callback;
      }),
      detach: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Debugger.enable') {
          parsed({ url: IFRAME_API_URL, scriptId: 'bootstrap' });
          parsed({ url: 'file:///fixture.js', scriptId: 'local' });
        }
        if (method === 'Debugger.getScriptSource')
          return { scriptSource: `const url = '${OBSERVED_WIDGET_URL}';` };
        return {};
      }),
    };
    const page = { context: () => ({ newCDPSession: async () => session }) };
    const evidence = await inspectLoadedYouTubeBootstrap(page);
    expect(evidence).toEqual([
      {
        url: IFRAME_API_URL,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        declaredWidgetUrls: [OBSERVED_WIDGET_URL],
      },
    ]);
    expect(session.send.mock.calls).toEqual([
      ['Debugger.enable'],
      ['Debugger.getScriptSource', { scriptId: 'bootstrap' }],
      ['Debugger.disable'],
    ]);
    expect(session.detach).toHaveBeenCalledOnce();
  });

  it('detaches even if reading the loaded script fails, without admitting the widget', async () => {
    let parsed = () => {};
    const session = {
      on: (_event, callback) => {
        parsed = callback;
      },
      detach: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Debugger.enable')
          parsed({ url: IFRAME_API_URL, scriptId: 'bootstrap' });
        if (method === 'Debugger.getScriptSource')
          throw new Error('source unavailable');
        return {};
      }),
    };
    await expect(
      inspectLoadedYouTubeBootstrap({
        context: () => ({ newCDPSession: async () => session }),
      }),
    ).rejects.toThrow('source unavailable');
    expect(session.send).toHaveBeenLastCalledWith('Debugger.disable');
    expect(session.detach).toHaveBeenCalledOnce();
    expect(
      Boolean(
        isClassifiedStartupRequest(
          { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL },
          [],
        ),
      ),
    ).toBe(false);
  });
});
