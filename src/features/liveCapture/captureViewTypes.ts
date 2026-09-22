export interface CaptureSourceDraft {
  id: string;
  name: string;
  kind: 'device' | 'network';
  videoDeviceId: string;
  audioDeviceId: string;
  url: string;
}
export interface CaptureDeviceOption {
  id: string;
  name: string;
  kind: 'video' | 'audio';
}
