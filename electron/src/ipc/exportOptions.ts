import * as os from 'os';

export type NormalizedAngleOption =
  | 'allAngles'
  | 'single'
  | 'multi'
  | 'angle1'
  | 'angle2';

type ExportAngleOption =
  | 'all'
  | 'angle1'
  | 'angle2'
  | 'allAngles'
  | 'single'
  | 'multi';

export const normalizeAngleOption = (
  angleOption: ExportAngleOption | undefined,
  mode: 'single' | 'dual' | undefined,
): NormalizedAngleOption => {
  if (angleOption === 'all' || angleOption === 'allAngles') {
    return 'allAngles';
  }
  if (angleOption === 'multi') {
    return 'multi';
  }
  if (angleOption === 'angle2') {
    return 'angle2';
  }
  if (angleOption === 'angle1') {
    return 'angle1';
  }
  if (mode === 'dual') {
    return 'multi';
  }
  return 'single';
};

export const ensureMp4 = (name: string): string =>
  name.toLowerCase().endsWith('.mp4') ? name : `${name}.mp4`;

export const getJapaneseFontPath = (isBold = false): string => {
  const platform = os.platform();
  if (platform === 'darwin') {
    return isBold
      ? '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'
      : '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc';
  }
  if (platform === 'win32') {
    return isBold
      ? 'C:\\Windows\\Fonts\\meiryob.ttc'
      : 'C:\\Windows\\Fonts\\meiryo.ttc';
  }
  return isBold
    ? '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
    : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
};

const wrapText = (text: string, maxChars = 60): string => {
  if (text.length <= maxChars) return text;
  const lines: string[] = [];
  let currentLine = '';
  const words = text.split(' ');

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxChars) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
};

export const escapeDrawtext = (text: string): string => {
  const wrapped = wrapText(text, 60);
  return wrapped
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\''")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
};

export const resolveDualSourceError = (
  mainSource: string | null | undefined,
  secondarySource: string | null | undefined,
): string | null => {
  if (!mainSource || !secondarySource) {
    return '2画面結合に必要な第2ソースがありません';
  }
  if (mainSource === secondarySource) {
    return '2画面結合では異なる映像ソースを指定してください';
  }
  return null;
};
