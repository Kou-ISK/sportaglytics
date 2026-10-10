import { createHash } from 'node:crypto';

export const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
export const OBSERVED_WIDGET_URLS = [
  'https://www.youtube.com/s/player/8ab5c328/www-widgetapi.vflset/www-widgetapi.js',
  'https://www.youtube.com/s/player/5203c085/www-widgetapi.vflset/www-widgetapi.js',
];

export const declaredObservedWidgets = (source) => {
  const normalized = source.replaceAll('\\/', '/');
  return OBSERVED_WIDGET_URLS.filter((url) =>
    ["'", '"'].some((quote) => normalized.includes(`${quote}${url}${quote}`)),
  );
};

export const isClassifiedStartupRequest = (request, verifiedWidgetUrls) =>
  request.phase === 'startup' &&
  request.type === 'script' &&
  (request.url === IFRAME_API_URL ||
    (OBSERVED_WIDGET_URLS.includes(request.url) &&
      verifiedWidgetUrls.includes(request.url)));

/** Read already-loaded scripts through CDP; this never fetches the remote URL. */
export const inspectLoadedYouTubeBootstrap = async (page) => {
  const session = await page.context().newCDPSession(page);
  const ids = new Set();
  session.on('Debugger.scriptParsed', (script) => {
    if (script.url === IFRAME_API_URL) ids.add(script.scriptId);
  });
  try {
    await session.send('Debugger.enable');
    const evidence = [];
    for (const scriptId of ids) {
      const { scriptSource } = await session.send('Debugger.getScriptSource', {
        scriptId,
      });
      evidence.push({
        url: IFRAME_API_URL,
        sha256: createHash('sha256').update(scriptSource).digest('hex'),
        declaredWidgetUrls: declaredObservedWidgets(scriptSource),
      });
    }
    return evidence;
  } finally {
    try {
      await session.send('Debugger.disable');
    } finally {
      await session.detach();
    }
  }
};
