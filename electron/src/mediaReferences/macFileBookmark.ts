import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);
// Fixed Foundation bridge, with data passed as argv rather than interpolated code.
// No Apple Events, application control, mounting, or interactive permission prompts.
const SCRIPT = `ObjC.import('Foundation');
function run(argv) {
  var input = JSON.parse(argv[0]), error = Ref(), url, data;
  if (input.path) {
    url = $.NSURL.fileURLWithPath(input.path);
    data = url.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(0, $(), $(), error);
    return data.isNil() ? '' : ObjC.unwrap(data.base64EncodedStringWithOptions(0));
  }
  data = $.NSData.alloc.initWithBase64EncodedStringOptions(input.bookmark, 0);
  var stale = Ref();
  url = $.NSURL.URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(
    data, $.NSURLBookmarkResolutionWithoutUI | $.NSURLBookmarkResolutionWithoutMounting, $(), stale, error);
  return url.isNil() ? '' : ObjC.unwrap(url.path);
}`;

const bookmarkOperation = async (
  input: { path: string } | { bookmark: string },
): Promise<string | undefined> => {
  if (process.platform !== 'darwin') return undefined;
  try {
    const { stdout } = await execute(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', SCRIPT, JSON.stringify(input)],
      {
        timeout: 5000,
        maxBuffer: 128 * 1024,
      },
    );
    return stdout.trim() || undefined;
  } catch {
    // Portable identity/relative-path resolution remains available on failure.
    return undefined;
  }
};

export const createMacFileBookmark = (
  filePath: string,
): Promise<string | undefined> => bookmarkOperation({ path: filePath });
export const resolveMacFileBookmark = (
  bookmark: string,
): Promise<string | undefined> => bookmarkOperation({ bookmark });
