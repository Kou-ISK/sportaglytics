import { createHash } from 'node:crypto';
import ts from 'typescript';

export const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
// The player revision rotates independently of this repository. Classify only
// this exact official shape AND a declaration in this run's loaded bootstrap.
const WIDGET_URL =
  /^https:\/\/www\.youtube\.com\/s\/player\/[0-9a-f]{8}\/www-widgetapi\.vflset\/www-widgetapi\.js$/;

export const declaredBootstrapWidgets = (source) => {
  // Parse without executing or fetching the script. AST literals exclude URL
  // text inside comments, unrelated strings, templates, and concatenations.
  const script = ts.createSourceFile(
    'loaded-iframe-api.js',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  if (script.parseDiagnostics.length) return [];
  const urls = new Set();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      WIDGET_URL.test(node.initializer.text)
    ) {
      urls.add(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(script);
  return [...urls];
};

export const isClassifiedStartupRequest = (request, verifiedWidgetUrls) =>
  request.phase === 'startup' &&
  request.type === 'script' &&
  (request.url === IFRAME_API_URL ||
    (WIDGET_URL.test(request.url) && verifiedWidgetUrls.includes(request.url)));

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
        declaredWidgetUrls: declaredBootstrapWidgets(scriptSource),
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
