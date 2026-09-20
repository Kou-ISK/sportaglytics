import { useEffect, useRef, useState } from 'react';
import type { PitchCalibration } from '../../../../types/playlist/core';
import type {
  TacticalBoard,
  TacticalMarker,
} from '../../../../types/playlist/tacticalBoard';
import type { TacticalBoardViewProps } from './TacticalBoardView';
import { useTacticalBoardEditor } from './useTacticalBoardEditor';
import {
  capturePitchFrame,
  recognizePitchFrame,
} from './pitchRecognitionGateway';
import { projectPitchDetections } from './pitchRecognition';
import { exportTacticalBoardPng } from './boardExportGateway';

interface BoardSession {
  key: string;
  frame: HTMLCanvasElement | null;
  image: string;
  time: number;
}
export const useTacticalBoard = (params: {
  documentKey: string;
  enabled: boolean;
  saved?: TacticalBoard;
  calibration?: PitchCalibration;
  time: number;
  clipStart: number;
  video: () => HTMLVideoElement | null;
  onSave: (board: TacticalBoard) => void;
  onSeek: (time: number) => void;
}): { onOpen: () => void; view: TacticalBoardViewProps } => {
  const [session, setSession] = useState<BoardSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<TacticalMarker[] | null>(null);
  const operation = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const editor = useTacticalBoardEditor({
    widthMeters: 70,
    lengthMeters: 100,
    time: 0,
    markers: [],
    arrows: [],
  });
  useEffect(
    () => () => {
      operation.current?.abort();
    },
    [params.documentKey],
  );
  const open = session?.key === params.documentKey;
  const calibration = params.calibration;
  const matchingTime = Boolean(
    session && Math.abs(session.time - editor.board.time) <= 0.12,
  );
  const calibrated = Boolean(
    calibration &&
    calibration.referenceTime !== undefined &&
    session &&
    Math.abs(calibration.referenceTime - session.time) <= 0.12 &&
    calibration.widthMeters === editor.board.widthMeters &&
    calibration.lengthMeters === editor.board.lengthMeters,
  );
  const close = (): void => {
    operation.current?.abort();
    setSession(null);
    setBusy(false);
  };
  return {
    onOpen: () => {
      if (!params.enabled) return;
      operation.current?.abort();
      setBusy(false);
      setCandidates(null);
      setError('');
      const time = Math.max(0, params.time - params.clipStart);
      let frame: HTMLCanvasElement | null = null,
        image = '';
      try {
        frame = capturePitchFrame(params.video());
        image = frame.toDataURL('image/jpeg', 0.8);
      } catch {
        setError('映像を読み込めませんでした。戦術盤は手動で編集できます。');
      }
      editor.reset(
        params.saved ?? {
          widthMeters: calibration?.widthMeters ?? 70,
          lengthMeters: calibration?.lengthMeters ?? 100,
          time,
          markers: [],
          arrows: [],
        },
      );
      setSession({ key: params.documentKey, frame, image, time });
    },
    view: {
      open,
      editor,
      svgRef,
      image: session?.image ?? '',
      busy,
      progress,
      error,
      candidates: matchingTime && calibrated ? candidates : null,
      canRecognize: Boolean(calibrated && matchingTime && session?.frame),
      recognitionHint: !matchingTime
        ? '保存した戦術盤と映像の時刻が異なります。戦術盤の時刻へ移動してください。'
        : !calibrated
          ? 'ピッチの4点を現在のフレームで較正・確認してから認識してください。'
          : '人物の足元を俯瞰図へ変換します。チームとボールの高さは判別しないため、配置を確認してください。',
      onGoToFrame: !matchingTime
        ? () => {
            close();
            params.onSeek(editor.board.time + params.clipStart);
          }
        : undefined,
      onClose: close,
      onUseCurrentFrame:
        !matchingTime && session
          ? () => {
              operation.current?.abort();
              setBusy(false);
              setCandidates(null);
              editor.onReplace({
                widthMeters: calibration?.widthMeters ?? 70,
                lengthMeters: calibration?.lengthMeters ?? 100,
                time: session.time,
                markers: [],
                arrows: [],
              });
            }
          : undefined,
      onSave: () => {
        if (!open) return;
        params.onSave(editor.board);
        close();
      },
      onDetect: async () => {
        if (
          !open ||
          busy ||
          !session?.frame ||
          !calibration ||
          !calibrated ||
          !matchingTime
        )
          return;
        operation.current?.abort();
        const controller = new AbortController();
        operation.current = controller;
        setBusy(true);
        setProgress(0);
        setCandidates(null);
        setError('');
        try {
          const detections = await recognizePitchFrame(
            session.frame,
            controller.signal,
            (value) => {
              if (!controller.signal.aborted) setProgress(value);
            },
          );
          if (!controller.signal.aborted)
            setCandidates(projectPitchDetections(detections, calibration));
        } catch {
          if (!controller.signal.aborted)
            setError(
              '映像の認識に失敗しました。再試行するか、ピッチをクリックして手動で配置してください。',
            );
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      },
      onCancelDetection: () => {
        operation.current?.abort();
        setBusy(false);
      },
      onImport: () => {
        if (open && calibrated && matchingTime && candidates?.length)
          editor.onImport(candidates);
        setCandidates(null);
      },
      onDismissCandidates: () => setCandidates(null),
      onExport: async () => {
        if (!svgRef.current) return;
        try {
          await exportTacticalBoardPng(svgRef.current);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : '画像を保存できませんでした。',
          );
        }
      },
    },
  };
};
