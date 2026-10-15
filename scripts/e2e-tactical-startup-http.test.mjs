import { describe, expect, it, vi } from 'vitest';
import {
  declaredObservedWidgets,
  IFRAME_API_URL,
  OBSERVED_WIDGET_URLS,
  inspectLoadedYouTubeBootstrap,
  isClassifiedStartupRequest,
} from './e2e-tactical-startup-http.mjs';

const [OBSERVED_WIDGET_URL, UPDATED_WIDGET_URL, LATEST_WIDGET_URL] =
  OBSERVED_WIDGET_URLS;
// Exact request observed in Windows run 38365031661. Sources below are synthetic.
const WINDOWS_WIDGET_URL =
  'https://www.youtube.com/s/player/ec429320/www-widgetapi.vflset/www-widgetapi.js';

describe('tactical board startup HTTP boundary', () => {
  it.each([
    [
      { phase: 'startup', type: 'script', url: WINDOWS_WIDGET_URL },
      [WINDOWS_WIDGET_URL],
      true,
    ],
    [{ phase: 'startup', type: 'script', url: WINDOWS_WIDGET_URL }, [], false],
    [
      { phase: 'startup', type: 'script', url: WINDOWS_WIDGET_URL },
      [LATEST_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: LATEST_WIDGET_URL },
      [WINDOWS_WIDGET_URL],
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: WINDOWS_WIDGET_URL },
      [WINDOWS_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'fetch', url: WINDOWS_WIDGET_URL },
      [WINDOWS_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: `${WINDOWS_WIDGET_URL}?x=1` },
      [`${WINDOWS_WIDGET_URL}?x=1`],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: WINDOWS_WIDGET_URL.replace(
          'www.youtube.com',
          'www.youtube.com.evil.test',
        ),
      },
      [
        WINDOWS_WIDGET_URL.replace(
          'www.youtube.com',
          'www.youtube.com.evil.test',
        ),
      ],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: WINDOWS_WIDGET_URL.replace('ec429320', 'unobserved'),
      },
      [WINDOWS_WIDGET_URL.replace('ec429320', 'unobserved')],
      false,
    ],
  ])(
    'requires exact current proof for the Windows widget: %j',
    (request, proof, accepted) => {
      expect(Boolean(isClassifiedStartupRequest(request, proof))).toBe(
        accepted,
      );
    },
  );

  it('extracts only the observed Windows URL from its own synthetic bootstrap declaration', () => {
    for (const quote of ["'", '"']) {
      for (const url of [
        WINDOWS_WIDGET_URL,
        WINDOWS_WIDGET_URL.replaceAll('/', '\\/'),
      ]) {
        expect(
          declaredObservedWidgets(`const url = ${quote}${url}${quote};`),
        ).toEqual([WINDOWS_WIDGET_URL]);
      }
    }
    expect(
      declaredObservedWidgets(`const url = '${LATEST_WIDGET_URL}';`),
    ).not.toContain(WINDOWS_WIDGET_URL);
    expect(
      declaredObservedWidgets(`const url = '${WINDOWS_WIDGET_URL}?x=1';`),
    ).toEqual([]);
    expect(
      declaredObservedWidgets(
        `const url = '${WINDOWS_WIDGET_URL.replace('ec429320', 'unobserved')}';`,
      ),
    ).toEqual([]);
  });

  it.each([
    [
      { phase: 'startup', type: 'script', url: LATEST_WIDGET_URL },
      [LATEST_WIDGET_URL],
      true,
    ],
    [{ phase: 'startup', type: 'script', url: LATEST_WIDGET_URL }, [], false],
    [
      {
        phase: 'startup',
        type: 'script',
        url: LATEST_WIDGET_URL.replace('www.youtube.com', 'example.test'),
      },
      [LATEST_WIDGET_URL.replace('www.youtube.com', 'example.test')],
      false,
    ],
    [
      {
        phase: 'startup',
        type: 'script',
        url: LATEST_WIDGET_URL.replace('22cb88bc', 'unobserved'),
      },
      [LATEST_WIDGET_URL.replace('22cb88bc', 'unobserved')],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: LATEST_WIDGET_URL },
      [UPDATED_WIDGET_URL],
      false,
    ],
    [
      { phase: 'recognition', type: 'script', url: LATEST_WIDGET_URL },
      [LATEST_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'fetch', url: LATEST_WIDGET_URL },
      [LATEST_WIDGET_URL],
      false,
    ],
    [
      { phase: 'startup', type: 'script', url: `${LATEST_WIDGET_URL}?x=1` },
      [LATEST_WIDGET_URL],
      false,
    ],
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

  it('requires new widget proof from its own loaded bootstrap', () => {
    expect(
      declaredObservedWidgets(`const url = '${LATEST_WIDGET_URL}';`),
    ).toEqual([LATEST_WIDGET_URL]);
    expect(
      declaredObservedWidgets(`const url = '${UPDATED_WIDGET_URL}';`),
    ).not.toContain(LATEST_WIDGET_URL);
    expect(
      declaredObservedWidgets(`const url = '${LATEST_WIDGET_URL}?x=1';`),
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
    ).toEqual([OBSERVED_WIDGET_URL, UPDATED_WIDGET_URL]);
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

describe('widget observed in installed Windows run 38597748824', () => {
  const url =
    'https://www.youtube.com/s/player/21090930/www-widgetapi.vflset/www-widgetapi.js';
  it('requires its own exact loaded-bootstrap declaration and startup script phase', () => {
    expect(declaredObservedWidgets(`const src = '${url}';`)).toEqual([url]);
    const request = { phase: 'startup', type: 'script', url };
    expect(isClassifiedStartupRequest(request, [url])).toBe(true);
    expect(isClassifiedStartupRequest(request, [])).toBe(false);
    expect(isClassifiedStartupRequest(request, [WINDOWS_WIDGET_URL])).toBe(
      false,
    );
    expect(
      isClassifiedStartupRequest({ ...request, phase: 'recognition' }, [url]),
    ).toBe(false);
    expect(
      isClassifiedStartupRequest({ ...request, type: 'fetch' }, [url]),
    ).toBe(false);
    expect(
      isClassifiedStartupRequest({ ...request, url: url + '?v=1' }, [
        url + '?v=1',
      ]),
    ).toBe(false);
  });
});

describe('widget observed in installed Windows run 38670235788', () => {
  const url =
    'https://www.youtube.com/s/player/0229cd64/www-widgetapi.vflset/www-widgetapi.js';
  it('requires its own exact bootstrap proof without allowing recognition or other requests', () => {
    expect(declaredObservedWidgets(`const src = '${url}';`)).toEqual([url]);
    const request = { phase: 'startup', type: 'script', url };
    expect(isClassifiedStartupRequest(request, [url])).toBe(true);
    for (const proof of [[], [WINDOWS_WIDGET_URL]])
      expect(isClassifiedStartupRequest(request, proof)).toBe(false);
    expect(
      isClassifiedStartupRequest({ ...request, phase: 'recognition' }, [url]),
    ).toBe(false);
    expect(
      isClassifiedStartupRequest({ ...request, type: 'fetch' }, [url]),
    ).toBe(false);
    expect(
      isClassifiedStartupRequest({ ...request, url: url + '?x=1' }, [
        url + '?x=1',
      ]),
    ).toBe(false);
  });
});
