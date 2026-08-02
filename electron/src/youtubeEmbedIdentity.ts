import type { Session } from 'electron';
import { YOUTUBE_EMBED_REFERRER } from '../../src/types/video/youtubeEmbed';

export const YOUTUBE_EMBED_URL_FILTER = {
  urls: [
    'https://youtube.com/embed/*',
    'https://*.youtube.com/embed/*',
    'https://youtube-nocookie.com/embed/*',
    'https://*.youtube-nocookie.com/embed/*',
  ],
};

const registeredSessions = new WeakSet<Session>();

export const withYoutubeEmbedClientIdentity = (
  requestHeaders: Record<string, string>,
): Record<string, string> => {
  const headersWithoutReferer = Object.fromEntries(
    Object.entries(requestHeaders).filter(
      ([name]) => name.toLowerCase() !== 'referer',
    ),
  );

  return {
    ...headersWithoutReferer,
    Referer: YOUTUBE_EMBED_REFERRER,
  };
};

export const registerYoutubeEmbedClientIdentity = (
  electronSession: Session,
): void => {
  if (registeredSessions.has(electronSession)) return;

  electronSession.webRequest.onBeforeSendHeaders(
    YOUTUBE_EMBED_URL_FILTER,
    (details, callback) => {
      callback({
        requestHeaders: withYoutubeEmbedClientIdentity(details.requestHeaders),
      });
    },
  );
  registeredSessions.add(electronSession);
};
