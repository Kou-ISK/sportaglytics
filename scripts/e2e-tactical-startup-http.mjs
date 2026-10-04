import { createHash } from 'node:crypto';

export const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
export const OBSERVED_WIDGET_URL =
  'https://www.youtube.com/s/player/8ab5c328/www-widgetapi.vflset/www-widgetapi.js';

export const declaresObservedWidget = (source) => {
  const normalized = source.replaceAll('\\/', '/');
  return ["'", '"'].some((quote) =>
    normalized.includes(`${quote}${OBSERVED_WIDGET_URL}${quote}`),
  );
};

export const isClassifiedStartupRequest = (request, bootstrapVerified) =>
  request.phase === 'startup' &&
  request.type === 'script' &&
  (request.url === IFRAME_API_URL ||
    (bootstrapVerified && request.url === OBSERVED_WIDGET_URL));

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
        declaresObservedWidget: declaresObservedWidget(scriptSource),
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
