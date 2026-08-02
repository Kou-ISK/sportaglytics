import type { Session } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { YOUTUBE_EMBED_REFERRER } from '../../src/types/video/youtubeEmbed';
import {
  registerYoutubeEmbedClientIdentity,
  withYoutubeEmbedClientIdentity,
  YOUTUBE_EMBED_URL_FILTER,
} from './youtubeEmbedIdentity';

describe('YouTube embed client identity', () => {
  it('adds the app identity as Referer without dropping existing headers', () => {
    expect(
      withYoutubeEmbedClientIdentity({
        Accept: 'text/html',
        'User-Agent': 'SporTagLytics',
      }),
    ).toEqual({
      Accept: 'text/html',
      'User-Agent': 'SporTagLytics',
      Referer: YOUTUBE_EMBED_REFERRER,
    });
  });

  it('replaces an existing Referer without emitting duplicate casing', () => {
    expect(
      withYoutubeEmbedClientIdentity({
        referer: 'file:///index.html',
      }),
    ).toEqual({ Referer: YOUTUBE_EMBED_REFERRER });
  });

  it('registers one scoped request listener per Electron session', () => {
    const onBeforeSendHeaders = vi.fn();
    const electronSession = {
      webRequest: { onBeforeSendHeaders },
    } as unknown as Session;

    registerYoutubeEmbedClientIdentity(electronSession);
    registerYoutubeEmbedClientIdentity(electronSession);

    expect(onBeforeSendHeaders).toHaveBeenCalledTimes(1);
    expect(onBeforeSendHeaders).toHaveBeenCalledWith(
      YOUTUBE_EMBED_URL_FILTER,
      expect.any(Function),
    );
    expect(YOUTUBE_EMBED_URL_FILTER.urls).toEqual(
      expect.arrayContaining([
        'https://*.youtube.com/embed/*',
        'https://*.youtube-nocookie.com/embed/*',
      ]),
    );
    expect(YOUTUBE_EMBED_URL_FILTER.urls).not.toContain(
      'https://*.youtube.com/*',
    );
  });
});
