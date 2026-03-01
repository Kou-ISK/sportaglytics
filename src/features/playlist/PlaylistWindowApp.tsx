import { PlaylistWindowView } from './components/PlaylistWindowView';
import { usePlaylistWindowController } from './hooks/playlist/usePlaylistWindowController';

export default function PlaylistWindowApp() {
  const controller = usePlaylistWindowController();
  return <PlaylistWindowView controller={controller} />;
}
