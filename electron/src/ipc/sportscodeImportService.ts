import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PackageDatas } from '../../../src/renderer';
import type {
  SportscodeImportRequest,
  SportscodeXmlSource,
} from '../../../src/shared/timeline/sportscodeImport';
import { validateTimelineDocumentData } from '../../../src/shared/timeline/timelineValidation';
import { createPackage } from './packageCreationService';
import { inspectPackageCompatibility } from './packageCompatibilityValidation';
import { checkMigrationCapacity } from './packageSourceSnapshot';
import { isPlainObject } from './ipcPayloadGuards';
import { writeTextFileAtomically } from './atomicTextFile';

const MAX_XML_BYTES = 16 * 1024 * 1024;
const text = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 32768 &&
  !value.includes('\0');

export const isSportscodeImportRequest = (
  value: unknown,
): value is SportscodeImportRequest => {
  if (
    !isPlainObject(value) ||
    !text(value.xmlPath) ||
    !text(value.videoPath) ||
    !text(value.directory) ||
    !text(value.packageName) ||
    typeof value.xmlSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.xmlSha256) ||
    typeof value.offsetSeconds !== 'number' ||
    !Number.isFinite(value.offsetSeconds) ||
    Math.abs(value.offsetSeconds) > 86400 ||
    (value.sessionStart !== null && typeof value.sessionStart !== 'string') ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > 100 ||
    !value.warnings.every(
      (warning: unknown) =>
        typeof warning === 'string' && warning.length <= 2048,
    )
  )
    return false;
  try {
    validateTimelineDocumentData(value.document);
  } catch {
    return false;
  }
  if (
    !isPlainObject(value.document) ||
    value.document.version !== 2 ||
    !Array.isArray(value.document.instances) ||
    !Array.isArray(value.document.rows)
  )
    return false;
  const rowNames = new Set(
    value.document.rows.map((row: unknown) =>
      isPlainObject(row) ? row.name : null,
    ),
  );
  return (
    value.document.instances.every(
      (item: unknown) =>
        isPlainObject(item) &&
        typeof item.memo === 'string' &&
        rowNames.has(item.actionName),
    ) && Buffer.byteLength(JSON.stringify(value.document)) <= MAX_XML_BYTES
  );
};

export const readSportscodeXmlSource = async (
  xmlPath: string,
): Promise<SportscodeXmlSource> => {
  if (!/\.xml$/i.test(xmlPath))
    throw new Error('Sportscodeから書き出した.xmlを選択してください。');
  const stat = await fs.lstat(xmlPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_XML_BYTES)
    throw new Error(
      'XMLはシンボリックリンクでない16MiB以下のファイルを選択してください。',
    );
  const bytes = await fs.readFile(xmlPath);
  if (bytes.length > MAX_XML_BYTES)
    throw new Error('XMLは16MiB以下にしてください。');
  const content = bytes.toString('utf8');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(content))
    throw new Error('外部参照や実体宣言を含むXMLには対応していません。');
  return {
    path: xmlPath,
    text: content,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

const contains = (parent: string, candidate: string): boolean => {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
};

const assertOutsideNativePackage = (
  source: string,
  destination: string,
): void => {
  let directory = path.dirname(source);
  while (directory !== path.dirname(directory)) {
    if (
      /\.(?:scpkg|sczip|stpkg)$/i.test(directory) &&
      contains(directory, destination)
    )
      throw new Error('元のパッケージの外に保存先を選択してください。');
    directory = path.dirname(directory);
  }
};

const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return false;
    throw error;
  }
};

/** Only a validated staging package becomes visible at the destination. Source files are read only. */
export const importSportscodePackage = async (
  request: SportscodeImportRequest,
): Promise<PackageDatas> => {
  if (!isSportscodeImportRequest(request))
    throw new Error('Sportscode読み込みの指定が不正です。');
  const xml = await readSportscodeXmlSource(request.xmlPath);
  if (xml.sha256 !== request.xmlSha256)
    throw new Error('XMLが選択後に変更されました。選び直してください。');
  if (!/\.(mp4|mov|m4v|webm)$/i.test(request.videoPath))
    throw new Error('対応するローカル映像を明示的に選択してください。');
  const videoStat = await fs.lstat(request.videoPath);
  if (!videoStat.isFile() || videoStat.isSymbolicLink())
    throw new Error('映像ファイルを確認できません。');
  const videoRealPath = await fs.realpath(request.videoPath);
  const directory = await fs.realpath(request.directory);
  assertOutsideNativePackage(await fs.realpath(request.xmlPath), directory);
  assertOutsideNativePackage(videoRealPath, directory);
  const packageName = /\.stpkg$/i.test(request.packageName)
    ? request.packageName
    : `${request.packageName}.stpkg`;
  if (
    path.basename(packageName) !== packageName ||
    packageName === '.stpkg' ||
    /[\\/:*?"<>|]/.test(packageName)
  )
    throw new Error('パッケージ名が不正です。');
  const destination = path.join(directory, packageName);
  if (await exists(destination))
    throw new Error('同名のパッケージがあります。別の名前を指定してください。');
  await checkMigrationCapacity(
    directory,
    videoStat.size + Buffer.byteLength(JSON.stringify(request.document)),
  );
  const staging = await fs.mkdtemp(
    path.join(directory, '.sportaglytics-import-'),
  );
  try {
    const result = await createPackage(
      staging,
      packageName,
      [
        {
          id: 'sportscode-video',
          name: 'Imported video',
          role: 'primary',
          clips: [
            {
              id: 'sportscode-source',
              sourceKind: 'local',
              source: videoRealPath,
              gapBeforeSeconds: 0,
            },
          ],
        },
      ],
      {
        team1Name: 'Team 1',
        team2Name: 'Team 2',
        actionList: request.document.rows.map((row) => row.name),
        sportscodeImport: {
          format: 'xml-edit-list',
          xmlName: path.basename(request.xmlPath),
          xmlSha256: xml.sha256,
          videoName: path.basename(request.videoPath),
          offsetSeconds: request.offsetSeconds,
          sessionStart: request.sessionStart,
          warnings: request.warnings,
        },
      },
    );
    const duration = result.angles[0]?.clips[0]?.durationSeconds;
    if (
      duration === undefined ||
      !Number.isFinite(duration) ||
      request.document.instances.some((item) => item.endTime > duration)
    )
      throw new Error(
        '場面の時刻が選択した映像の長さを超えています。映像と秒数補正を確認してください。',
      );
    await writeTextFileAtomically(
      result.timelinePath,
      JSON.stringify(request.document),
    );
    const stagedPackage = path.dirname(result.timelinePath);
    const compatibility = await inspectPackageCompatibility(stagedPackage);
    if (compatibility.needsMigration || compatibility.missingMedia.length)
      throw new Error('作成したプロジェクトの検証に失敗しました。');
    const currentVideo = await fs.lstat(request.videoPath);
    if (
      currentVideo.size !== videoStat.size ||
      currentVideo.mtimeMs !== videoStat.mtimeMs ||
      currentVideo.ino !== videoStat.ino ||
      currentVideo.isSymbolicLink() ||
      (await readSportscodeXmlSource(request.xmlPath)).sha256 !== xml.sha256
    )
      throw new Error(
        '読み込み中に元ファイルが変更されました。再試行してください。',
      );
    if (await exists(destination))
      throw new Error(
        '同名のパッケージが作成されました。別の名前を指定してください。',
      );
    await fs.rename(stagedPackage, destination);
    const movePath = (file: string): string =>
      contains(stagedPackage, file)
        ? path.join(destination, path.relative(stagedPackage, file))
        : file;
    return {
      ...result,
      timelinePath: movePath(result.timelinePath),
      metaDataConfigFilePath: movePath(result.metaDataConfigFilePath),
      tightViewPath: movePath(result.tightViewPath),
      wideViewPath: result.wideViewPath ? movePath(result.wideViewPath) : null,
      angles: result.angles.map((angle) => ({
        ...angle,
        absolutePath: movePath(angle.absolutePath),
        clips: angle.clips.map((clip) => ({
          ...clip,
          absolutePath: clip.absolutePath
            ? movePath(clip.absolutePath)
            : undefined,
        })),
      })),
    };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
};
