import type { ReactElement } from 'react';
import { CaptureSetupView } from './CaptureSetupView';
import { useCaptureController } from './useCaptureController';

export const CaptureScreen = (): ReactElement => {
  const controller = useCaptureController();
  return (
    <CaptureSetupView
      {...controller}
      onHide={controller.hide}
      onNameChange={controller.setName}
      onSourcesChange={controller.setSources}
      onQualityChange={controller.setQuality}
      onRefreshDevices={() => {
        void controller.refreshDevices();
      }}
      onAddSource={controller.addSource}
      onStart={() => {
        void controller.start();
      }}
      onStop={() => {
        void controller.stop();
      }}
      onRetry={(id) => {
        void controller.retry(id);
      }}
    />
  );
};
