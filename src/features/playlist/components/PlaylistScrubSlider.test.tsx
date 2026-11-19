// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PlaylistScrubSlider } from './PlaylistScrubSlider';

it('uses the release coordinate when it differs from the last movement, preserving the confirmed playback clock', () => {
  const preview = vi.fn(),
    commit = vi.fn();
  const ui = render(
    <PlaylistScrubSlider
      min={10}
      max={20}
      time={12}
      onPreview={preview}
      onCommit={commit}
    />,
  );
  const bar = ui.container.querySelector<HTMLElement>('.MuiSlider-root');
  if (!bar) throw Error('slider missing');
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 100, 20),
  );
  fireEvent.mouseDown(bar, { clientX: 40, button: 0, buttons: 1 });
  fireEvent.mouseMove(document, { clientX: 20, buttons: 1 });
  fireEvent.mouseUp(document, { clientX: 70, button: 0 });
  expect(preview).toHaveBeenCalled();
  expect(commit).toHaveBeenCalledExactlyOnceWith(17);
  ui.unmount();
});
it('closes a pending drag using its original owner when the control disappears', () => {
  const first = vi.fn(),
    second = vi.fn(),
    preview = vi.fn();
  const ui = render(
    <PlaylistScrubSlider
      min={0}
      max={10}
      time={1}
      onPreview={preview}
      onCommit={first}
    />,
  );
  const bar = ui.container.querySelector<HTMLElement>('.MuiSlider-root');
  if (!bar) throw Error('slider missing');
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 100, 20),
  );
  fireEvent.mouseDown(bar, { clientX: 40, button: 0, buttons: 1 });
  ui.rerender(
    <PlaylistScrubSlider
      min={0}
      max={10}
      time={1}
      onPreview={preview}
      onCommit={second}
    />,
  );
  ui.unmount();
  expect(first).toHaveBeenCalledExactlyOnceWith(4);
  expect(second).not.toHaveBeenCalled();
});
