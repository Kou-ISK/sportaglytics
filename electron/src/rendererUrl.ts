import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Encode drive letters, Unicode, spaces and URL delimiters before adding a route. */
export const getRendererUrl = (route = ''): string => {
  const url = pathToFileURL(resolve(__dirname, '../../index.html'));
  url.hash = route;
  return url.href;
};
