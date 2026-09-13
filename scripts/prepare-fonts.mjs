import { resolve } from 'node:path';
import { downloadVerified } from './download-verified.mjs';

const base =
  'https://raw.githubusercontent.com/notofonts/noto-cjk/523d033d6cb47f4a80c58a35753646f5c3608a78';
for (const [source, name, sha256] of [
  [
    'Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf',
    'NotoSansCJKjp-Regular.otf',
    '68a3fc98800b2a27b371f2fb79991daf3633bd89309d4ffaa6946fd587f375b5',
  ],
  [
    'Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf',
    'NotoSansCJKjp-Bold.otf',
    'e53dcb0dcb2922e45d01aae1ebd2f382bb81d4229b18b6b883bd170678af1f76',
  ],
  [
    'LICENSE',
    'OFL.txt',
    '6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2',
  ],
]) {
  await downloadVerified(
    `${base}/${source}`,
    resolve('.cache/fonts', name),
    sha256,
  );
}
