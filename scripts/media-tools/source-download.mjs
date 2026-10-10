import { downloadVerified } from '../download-verified.mjs';

// Every official mirror must supply the same pinned bytes. HTML error pages and
// corrupted caches never become accepted source archives.
export const downloadSourceArchive = async (source, file) => {
  const urls = [source.url, ...(source.mirrors ?? [])];
  for (const [index, url] of urls.entries()) {
    try {
      await downloadVerified(url, file, source.sha256);
      return;
    } catch (error) {
      if (index === urls.length - 1) throw error;
      console.warn(
        `Source download failed for ${source.directory}; trying the next pinned mirror.`,
      );
    }
  }
};
