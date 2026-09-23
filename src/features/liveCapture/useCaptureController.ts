import { getDeviceRecordingCodec } from './deviceRecorder';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CaptureSnapshot,
  CaptureStartRequest,
  ILiveCaptureAPI,
} from '../../types/liveCapture';
import { isCaptureStartRequest } from '../../shared/liveCapture/validation';
import {
  openCaptureDevice,
  recordCaptureDevice,
  type DeviceRecording,
} from './deviceRecorder';

import type {
  CaptureDeviceOption,
  CaptureSourceDraft,
} from './captureViewTypes';
import type { CaptureSetupViewProps } from './CaptureSetupView';
import { discoverCaptureDevices } from './captureDevices';

const captureAPI = (): ILiveCaptureAPI => {
  const api = window.electronAPI?.liveCapture;
  if (!api)
    throw new Error('ライブキャプチャはデスクトップアプリで利用できます。');
  return api;
};

const newInput = (index: number): CaptureSourceDraft => ({
  id: crypto.randomUUID(),
  name: `アングル${index}`,
  kind: 'device',
  videoDeviceId: '',
  audioDeviceId: '',
  url: '',
});

type CaptureController = Omit<CaptureSetupViewProps, `on${string}`> & {
  setName: (value: string) => void;
  setSources: (value: CaptureSourceDraft[]) => void;
  setQuality: (value: CaptureStartRequest['quality']) => void;
  refreshDevices: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  hide: () => void;
  retry: (id: string) => Promise<void>;
  addSource: () => void;
};

export const useCaptureController = (): CaptureController => {
  const [name, setName] = useState('ライブ録画');
  const [sources, setSources] = useState<CaptureSourceDraft[]>(() => [
    newInput(1),
  ]);
  const [quality, setQuality] =
    useState<CaptureStartRequest['quality']>('1080p');
  const [devices, setDevices] = useState<CaptureDeviceOption[]>([]);
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<CaptureSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const recordings = useRef(new Map<string, DeviceRecording>());
  const current = useRef(snapshot);
  current.current = snapshot;
  const stopping = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const reportError = useCallback((message: string): void => {
    if (mounted.current) setError(message);
  }, []);

  const stop = useCallback((): Promise<void> => {
    if (stopping.current) return stopping.current;
    const id = current.current?.id;
    if (!id) return Promise.resolve();
    setBusy(true);
    stopping.current = (async () => {
      await Promise.all(
        [...recordings.current.values()].map((recording) => recording.stop()),
      );
      recordings.current.clear();
      await captureAPI().stop(id);
    })()
      .catch(() =>
        reportError(
          '録画の停止に失敗しました。キャプチャ画面で保存状態を確認してください。',
        ),
      )
      .finally(() => {
        stopping.current = null;
        if (mounted.current) {
          setBusy(false);
          setStreams({});
        }
      });
    return stopping.current;
  }, [reportError]);

  useEffect(() => {
    mounted.current = true;
    const api = window.electronAPI?.liveCapture;
    if (!api) {
      reportError('ライブキャプチャはデスクトップアプリで利用できます。');
      return;
    }
    const receive = (state: CaptureSnapshot | null): void => {
      if (
        !mounted.current ||
        (state &&
          current.current?.id === state.id &&
          current.current.elapsedSeconds > state.elapsedSeconds)
      )
        return;
      current.current = state;
      setSnapshot(state);
      if (state && ['completed', 'error'].includes(state.phase)) {
        for (const recording of recordings.current.values()) recording.abort();
        recordings.current.clear();
        setStreams({});
      }
    };
    let receivedState = false;
    const unsubscribe = api.onState((state) => {
      receivedState = true;
      receive(state);
    });
    const unsubscribeStop = api.onStopRequest(() => {
      void stop();
    });
    void api
      .getState()
      .then((state) => {
        if (!receivedState) receive(state);
      })
      .catch(() => reportError('録画の状態を読み込めませんでした。'));
    void api
      .capabilities()
      .then((value) => {
        if (mounted.current) setNetworkAvailable(value.network);
      })
      .catch(() =>
        reportError(
          '映像処理ツールを利用できません。アプリのインストールを確認してください。',
        ),
      );
    const ownedRecordings = recordings.current;
    return () => {
      mounted.current = false;
      unsubscribe();
      unsubscribeStop();
      for (const recording of ownedRecordings.values()) void recording.stop();
      ownedRecordings.clear();
    };
  }, [reportError, stop]);

  const refreshDevices = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      await captureAPI().authorizeDevices();
      const found = await discoverCaptureDevices();
      if (mounted.current) setDevices(found);
    } catch {
      reportError(
        'カメラを確認できません。接続とOSのカメラ権限を確認してください。',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [reportError]);

  const start = useCallback(async (): Promise<void> => {
    const request: CaptureStartRequest = {
      name: name.trim(),
      quality,
      inputs: sources.map((source) =>
        source.kind === 'network'
          ? {
              id: source.id,
              name: source.name,
              kind: 'network',
              url: source.url.trim(),
            }
          : {
              id: source.id,
              name: source.name,
              kind: 'device',
              videoCodec: getDeviceRecordingCodec(),
            },
      ),
    };
    if (!isCaptureStartRequest(request)) {
      reportError(
        '名前と映像入力を確認してください。IP映像には配信URLを指定します。',
      );
      return;
    }
    if (
      sources.some((source) => source.kind === 'network') &&
      !networkAvailable
    ) {
      reportError(
        'この映像処理ツールはIP入力に対応していません。最新のメディアツールを同梱したアプリをご利用ください。',
      );
      return;
    }
    const deviceIds = sources
      .filter((source) => source.kind === 'device')
      .map((source) => source.videoDeviceId);
    if (new Set(deviceIds).size !== deviceIds.length) {
      reportError('同じカメラを複数の入力に選択できません。');
      return;
    }
    setBusy(true);
    setError('');
    const prepared = new Map<string, MediaStream>();
    let started: CaptureSnapshot | null = null;
    try {
      if (deviceIds.length) await captureAPI().authorizeDevices();
      for (const source of sources) {
        if (source.kind === 'device')
          prepared.set(
            source.id,
            await openCaptureDevice({ ...source, quality }),
          );
      }
      if (!mounted.current) throw new Error('Capture window closed');
      started = await captureAPI().start(request);
      if (!mounted.current) throw new Error('Capture window closed');
      if (!started) {
        for (const stream of prepared.values())
          stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.current = started;
      setSnapshot(started);
      for (const [id, stream] of prepared)
        recordings.current.set(
          id,
          recordCaptureDevice(
            stream,
            started.id,
            id,
            captureAPI(),
            reportError,
            quality,
          ),
        );
      setStreams(Object.fromEntries(prepared));
    } catch {
      for (const stream of prepared.values())
        stream.getTracks().forEach((track) => track.stop());
      if (started)
        await captureAPI()
          .stop(started.id)
          .catch(() => undefined);
      reportError(
        '録画を開始できません。カメラ・マイクの権限、接続、保存先の空き容量を確認してください。',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [name, networkAvailable, quality, reportError, sources]);

  const retry = useCallback(
    async (id: string): Promise<void> => {
      const state = current.current;
      const source = sources.find((item) => item.id === id);
      if (!state || !source) return;
      setBusy(true);
      setError('');
      let stream: MediaStream | undefined;
      try {
        await recordings.current.get(id)?.stop();
        if (source.kind === 'device')
          stream = await openCaptureDevice({ ...source, quality });
        await captureAPI().retry(state.id, id);
        if (stream) {
          recordings.current.set(
            id,
            recordCaptureDevice(
              stream,
              state.id,
              id,
              captureAPI(),
              reportError,
              quality,
            ),
          );
          const recordedStream = stream;
          setStreams((previous) => ({ ...previous, [id]: recordedStream }));
        }
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        reportError('再接続できませんでした。接続先と機器を確認してください。');
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [quality, reportError, sources],
  );

  return {
    name,
    setName,
    sources,
    setSources,
    quality,
    setQuality,
    devices,
    refreshDevices,
    networkAvailable,
    snapshot,
    busy,
    error,
    streams,
    start,
    stop,
    retry,
    hide: (): void => {
      void window.electronAPI?.liveCapture
        .hide()
        .catch(() => reportError('キャプチャ画面を閉じられませんでした。'));
    },
    addSource: (): void =>
      setSources((previous) =>
        previous.length < 4
          ? [...previous, newInput(previous.length + 1)]
          : previous,
      ),
  };
};
