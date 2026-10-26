// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NativeSurfaceView } from './NativeSurfaceView';
it('retains the backing pixel dimensions required by the qualified native binder independently of CSS size', () => {
  const rendered = render(<NativeSurfaceView id="surface" visible={false} />);
  const canvas = rendered.getByLabelText('ネイティブ再生映像');
  if (!(canvas instanceof HTMLCanvasElement)) throw Error('canvas required');
  expect([canvas.width, canvas.height]).toEqual([1920, 1080]);
  expect(canvas.style.width).toBe('100%');
  rendered.rerender(<NativeSurfaceView id="surface" visible />);
  expect(rendered.getByLabelText('ネイティブ再生映像')).toBe(canvas);
  expect(canvas.style.visibility).toBe('visible');
  rendered.unmount();
});
