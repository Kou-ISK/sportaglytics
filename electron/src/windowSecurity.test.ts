import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { getRendererUrl, isTrustedRendererUrl } from './rendererUrl';
import { applyWebContentsSecurity } from './windowSecurity';

describe('renderer document trust', () => {
  it('accepts the app document and its hash routes only', () => {
    for (const route of ['', '/timeline', '/playlist', '/live-capture']) {
      expect(isTrustedRendererUrl(getRendererUrl(route))).toBe(true);
    }
    for (const url of [
      '',
      'not a url',
      'about:blank',
      'data:text/html,<h1>foreign</h1>',
      'https://www.youtube.com/embed/example',
      'http://localhost:3000/',
      getRendererUrl().replace('index.html', 'foreign.html'),
      `${getRendererUrl()}?foreign=1`,
      `${getRendererUrl()}/foreign.html`,
    ]) {
      expect(isTrustedRendererUrl(url), url).toBe(false);
    }
  });

  it('rejects foreign top-level navigations and redirects but leaves iframe redirects alone', () => {
    const contents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn(),
    });
    // This transport double exercises the real registered event handlers.
    applyWebContentsSecurity(contents as unknown as WebContents);
    const allowed = { preventDefault: vi.fn() };
    contents.emit('will-navigate', allowed, getRendererUrl('/settings'));
    expect(allowed.preventDefault).not.toHaveBeenCalled();
    for (const url of [
      'file:///fixture/foreign.html',
      'data:text/html,foreign',
      'https://example.invalid/',
      'about:blank',
    ]) {
      const blocked = { preventDefault: vi.fn() };
      contents.emit('will-navigate', blocked, url);
      expect(blocked.preventDefault).toHaveBeenCalledOnce();
    }
    const redirect = {
      isMainFrame: true,
      url: 'https://example.invalid/',
      preventDefault: vi.fn(),
    };
    contents.emit('will-redirect', redirect);
    expect(redirect.preventDefault).toHaveBeenCalledOnce();
    const iframeRedirect = {
      ...redirect,
      isMainFrame: false,
      preventDefault: vi.fn(),
    };
    contents.emit('will-redirect', iframeRedirect);
    expect(iframeRedirect.preventDefault).not.toHaveBeenCalled();
    const open = contents.setWindowOpenHandler.mock.calls[0][0];
    expect(open()).toEqual({ action: 'deny' });
  });
});
