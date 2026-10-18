import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Encode drive letters, Unicode, spaces and URL delimiters before adding a route. */
export const getRendererUrl = (route = ''): string => {
  const url = pathToFileURL(resolve(__dirname, '../../index.html'));
  url.hash = route;
  return url.href;
};

/** Routes share one shipped document; other local files are not app renderers. */
export const isTrustedRendererUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href === getRendererUrl();
  } catch {
    return false;
  }
};
