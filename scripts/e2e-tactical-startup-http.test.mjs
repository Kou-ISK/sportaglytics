import { describe, expect, it, vi } from 'vitest';
import {
  declaresObservedWidget,
  IFRAME_API_URL,
  OBSERVED_WIDGET_URL,
  inspectLoadedYouTubeBootstrap,
  isClassifiedStartupRequest,
} from './e2e-tactical-startup-http.mjs';

describe('tactical board startup HTTP boundary', () => {
  it.each([
    [{ phase: 'startup', type: 'script', url: IFRAME_API_URL }, false, true],
    [
      { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL },
      true,
      true,
    ],
    [
      { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL },
      false,
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: IFRAME_API_URL },
      true,
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: OBSERVED_WIDGET_URL },
      true,
      false,
    ],
    [
      { phase: 'startup', type: 'fetch', url: OBSERVED_WIDGET_URL },
      true,
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: `${OBSERVED_WIDGET_URL}?x=1` },
      true,
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
      true,
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: OBSERVED_WIDGET_URL.replace('8ab5c328', 'other'),
      },
      true,
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: 'https://example.test/model.bin',
      },
      true,
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: IFRAME_API_URL.replace('https:', 'http:'),
      },
      true,
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
      declaresObservedWidget(`const url = '${OBSERVED_WIDGET_URL}';`),
    ).toBe(true);
    expect(
      declaresObservedWidget(
        `const url = "${OBSERVED_WIDGET_URL.replaceAll('/', '\\/')}";`,
      ),
    ).toBe(true);
    expect(
      declaresObservedWidget(`const url = '${OBSERVED_WIDGET_URL}?x=1';`),
    ).toBe(false);
    expect(
      declaresObservedWidget(
        `const url = '${OBSERVED_WIDGET_URL.replace('8ab5c328', 'other')}';`,
      ),
    ).toBe(false);
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
        declaresObservedWidget: true,
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
          false,
        ),
      ),
    ).toBe(false);
  });
});
