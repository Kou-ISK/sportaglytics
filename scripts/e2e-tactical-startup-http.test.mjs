import { describe, expect, it, vi } from 'vitest';
import {
  declaredBootstrapWidgets,
  IFRAME_API_URL,
  inspectLoadedYouTubeBootstrap,
  isClassifiedStartupRequest,
} from './e2e-tactical-startup-http.mjs';

// Exact shape observed in installed Windows run 39791130218. Source fixtures
// below are synthetic; they do not substitute for same-run CDP evidence.
const OBSERVED_WIDGET_URL =
  'https://www.youtube.com/s/player/55de7e60/www-widgetapi.vflset/www-widgetapi.js';
const NEXT_WIDGET_URL = OBSERVED_WIDGET_URL.replace('55de7e60', 'abcdef12');
const request = { phase: 'startup', type: 'script', url: OBSERVED_WIDGET_URL };

describe('tactical board startup HTTP boundary', () => {
  it.each([OBSERVED_WIDGET_URL, NEXT_WIDGET_URL])(
    'classifies each revision only with its own loaded declaration: %s',
    (url) => {
      for (const quote of ["'", '"']) {
        for (const literal of [url, url.replaceAll('/', '\\/')]) {
          const proof = declaredBootstrapWidgets(
            `const src = ${quote}${literal}${quote};`,
          );
          expect(proof).toEqual([url]);
          expect(isClassifiedStartupRequest({ ...request, url }, proof)).toBe(
            true,
          );
        }
      }
      expect(isClassifiedStartupRequest({ ...request, url }, [])).toBe(false);
    },
  );

  it('does not reuse another revision declaration or duplicate proof', () => {
    const proof = declaredBootstrapWidgets(
      `const a = '${OBSERVED_WIDGET_URL}', b = '${OBSERVED_WIDGET_URL}';`,
    );
    expect(proof).toEqual([OBSERVED_WIDGET_URL]);
    expect(
      isClassifiedStartupRequest({ ...request, url: NEXT_WIDGET_URL }, proof),
    ).toBe(false);
  });

  const invalidURLs = [
    OBSERVED_WIDGET_URL + '?x=1',
    OBSERVED_WIDGET_URL + '#part',
    OBSERVED_WIDGET_URL + '\n',
    OBSERVED_WIDGET_URL.replace('https:', 'http:'),
    OBSERVED_WIDGET_URL.replace('www.youtube.com', 'youtube.com'),
    OBSERVED_WIDGET_URL.replace('www.youtube.com', 'www.youtube.com.evil.test'),
    OBSERVED_WIDGET_URL.replace('www.youtube.com', 'www.youtube.com@evil.test'),
    OBSERVED_WIDGET_URL.replace('www.youtube.com', 'user@www.youtube.com'),
    OBSERVED_WIDGET_URL.replace('www.youtube.com', 'www.youtube.com:443'),
    OBSERVED_WIDGET_URL.replace('/s/player/', '/s/player/../player/'),
    OBSERVED_WIDGET_URL.replace('55de7e60', 'other'),
    OBSERVED_WIDGET_URL.replace('55de7e60', '55DE7E60'),
    OBSERVED_WIDGET_URL.replace('55de7e60', '55de7e600'),
    OBSERVED_WIDGET_URL.replace('www-widgetapi.js', 'other.js'),
    OBSERVED_WIDGET_URL.replace('/s/player/', '/s%2fplayer/'),
    'https://example.test/model.bin',
  ];
  it.each(invalidURLs)(
    'rejects a URL outside the exact shape even if declared: %s',
    (url) => {
      const source = `const src = ${JSON.stringify(url)};`;
      expect(declaredBootstrapWidgets(source)).toEqual([]);
      expect(isClassifiedStartupRequest({ ...request, url }, [url])).toBe(
        false,
      );
    },
  );

  it.each([
    `// const src = '${OBSERVED_WIDGET_URL}';`,
    `/* '${OBSERVED_WIDGET_URL}' */`,
    `const text = ${JSON.stringify("const src = '" + OBSERVED_WIDGET_URL + "';")};`,
    `const src = \`${OBSERVED_WIDGET_URL}\`;`,
    `const src = 'https://www.youtube.com/s/player/' + '55de7e60/www-widgetapi.vflset/www-widgetapi.js';`,
    `const src = '${OBSERVED_WIDGET_URL}' + '?x=1';`,
    `const src = prefix + '${OBSERVED_WIDGET_URL}';`,
    `const src = choose('${OBSERVED_WIDGET_URL}');`,
    `const src = '${OBSERVED_WIDGET_URL}`, // Syntax error, not a loaded declaration.
    '',
  ])(
    'does not infer declarations from non-literal or invalid code: %s',
    (source) => {
      expect(declaredBootstrapWidgets(source)).toEqual([]);
    },
  );

  it.each([OBSERVED_WIDGET_URL, IFRAME_API_URL])(
    'keeps recognition, fetch and other phases out of the startup classification: %s',
    (url) => {
      expect(isClassifiedStartupRequest({ ...request, url }, [url])).toBe(true);
      expect(
        isClassifiedStartupRequest({ ...request, url, phase: 'recognition' }, [
          url,
        ]),
      ).toBe(false);
      expect(
        isClassifiedStartupRequest({ ...request, url, phase: 'other' }, [url]),
      ).toBe(false);
      expect(
        isClassifiedStartupRequest({ ...request, url, type: 'fetch' }, [url]),
      ).toBe(false);
    },
  );

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
