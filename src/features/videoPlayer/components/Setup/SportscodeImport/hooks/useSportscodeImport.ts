import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SportscodeXmlSource } from '../../../../../../shared/timeline/sportscodeImport';
import type { PackageLoadResult } from '../../VideoPathSelector/types';
import {
  selectPackageDirectory,
  selectVideoFile,
} from '../../VideoPathSelector/gateway/packageGateway';
import { buildPackageLoadResult } from '../../VideoPathSelector/utils/packageCreationMappers';
import {
  createSportscodeProject,
  selectSportscodeXml,
} from '../gateway/sportscodeImportGateway';
import { parseSportscodeXml } from '../domain/parseSportscodeXml';
import type { SportscodeImportViewProps } from '../SportscodeImportView';

const importErrorMessage = (failure: unknown, fallback: string): string => {
  if (!(failure instanceof Error)) return fallback;
  // Electron prepends its IPC channel name to rejections. Keep the cause that
  // helps the user correct their input, rather than exposing that transport.
  return (
    failure.message.replace(
      /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,
      '',
    ) || fallback
  );
};

export const useSportscodeImport = ({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (value: PackageLoadResult) => void;
}): SportscodeImportViewProps => {
  const operation = useRef(false);
  const [source, setSource] = useState<SportscodeXmlSource | null>(null);
  const [video, setVideo] = useState('');
  const [name, setName] = useState('');
  const [offset, setOffset] = useState('0');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setSource(null);
    setVideo('');
    setName('');
    setOffset('0');
    setConfirmed(false);
    setBusy(false);
    setError('');
  }, [open]);
  const parsed = useMemo(() => {
    if (!source) return { result: null, error: '' };
    try {
      if (!offset.trim()) throw new Error('秒数補正を入力してください。');
      return {
        result: parseSportscodeXml(source.text, Number(offset)),
        error: '',
      };
    } catch (failure) {
      return {
        result: null,
        error: importErrorMessage(failure, 'XMLを読み込めません。'),
      };
    }
  }, [source, offset]);
  const pickXml = useCallback(async (): Promise<void> => {
    try {
      const next = await selectSportscodeXml();
      if (!next) return;
      setSource(next);
      setConfirmed(false);
      setError('');
      setName(
        next.path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.xml$/i, '') ?? 'Imported project',
      );
    } catch (failure) {
      setError(importErrorMessage(failure, 'XMLを選択できません。'));
    }
  }, []);
  const pickVideo = useCallback(async (): Promise<void> => {
    try {
      const next = await selectVideoFile();
      if (next) {
        setVideo(next);
        setConfirmed(false);
        setError('');
      }
    } catch (failure) {
      setError(importErrorMessage(failure, '映像を選択できません。'));
    }
  }, []);
  const canImport = Boolean(
    source && video && name.trim() && parsed.result && confirmed && !busy,
  );
  const importProject = useCallback(async (): Promise<void> => {
    if (!canImport || !source || !parsed.result || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      const directory = await selectPackageDirectory();
      if (!directory) return;
      setBusy(true);
      setError('');
      const result = await createSportscodeProject({
        xmlPath: source.path,
        xmlSha256: source.sha256,
        videoPath: video,
        directory,
        packageName: name.trim(),
        offsetSeconds: Number(offset),
        document: parsed.result.document,
        sessionStart: parsed.result.sessionStart,
        warnings: parsed.result.warnings,
      });
      onImported(buildPackageLoadResult(result));
      onClose();
    } catch (failure) {
      setError(
        importErrorMessage(failure, 'プロジェクトの作成に失敗しました。'),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [
    canImport,
    source,
    parsed.result,
    video,
    name,
    offset,
    onImported,
    onClose,
  ]);
  return {
    open,
    busy,
    error: error || parsed.error,
    xmlName: source?.path.split(/[\\/]/).pop() ?? '',
    videoName: video.split(/[\\/]/).pop() ?? '',
    name,
    offset,
    confirmed,
    preview: parsed.result,
    canImport,
    onSelectXml: () => void pickXml(),
    onSelectVideo: () => void pickVideo(),
    onNameChange: setName,
    onOffsetChange: (value) => {
      setOffset(value);
      setConfirmed(false);
      setError('');
    },
    onConfirm: setConfirmed,
    onImport: () => void importProject(),
    onClose: () => {
      if (!busy) onClose();
    },
  };
};
