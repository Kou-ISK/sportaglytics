import { PlaylistProvider } from '../features/playlist';
import { VideoPlayerScreen } from '../features/videoPlayer';

export const VideoPlayerApp = () => {
  return (
    <PlaylistProvider>
      <VideoPlayerScreen />
    </PlaylistProvider>
  );
};
