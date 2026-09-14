// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDragAndDrop } from './useDragAndDrop';
import { resolveDroppedPackagePath } from '../gateway/packageGateway';
vi.mock('../gateway/packageGateway', () => ({
  resolveDroppedPackagePath: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('package drop', () => {
  const open = vi.fn();
  const invalid = vi.fn();
  const Harness = ({
    disabled = false,
  }: {
    disabled?: boolean;
  }): React.ReactElement => {
    const { handlers } = useDragAndDrop(open, invalid, disabled);
    return <div {...handlers} data-testid="drop" />;
  };
  it('uses the preload path, not a renderer File.path', () => {
    vi.mocked(resolveDroppedPackagePath).mockReturnValue(
      '/matches/final.stpkg',
    );
    render(<Harness />);
    const file = new File([], 'final.stpkg');
    fireEvent.drop(screen.getByTestId('drop'), {
      dataTransfer: { files: [file] },
    });
    expect(resolveDroppedPackagePath).toHaveBeenCalledWith(file);
    expect(open).toHaveBeenCalledWith('/matches/final.stpkg');
    expect(invalid).not.toHaveBeenCalled();
  });
  it('reports invalid and multiple drops without opening anything', () => {
    vi.mocked(resolveDroppedPackagePath).mockReturnValue('');
    render(<Harness />);
    fireEvent.drop(screen.getByTestId('drop'), {
      dataTransfer: { files: [new File([], 'movie.mp4')] },
    });
    fireEvent.drop(screen.getByTestId('drop'), {
      dataTransfer: {
        files: [new File([], 'one.stpkg'), new File([], 'two.stpkg')],
      },
    });
    expect(open).not.toHaveBeenCalled();
    expect(invalid).toHaveBeenCalledTimes(2);
  });
  it('ignores drops during loading or creation', () => {
    render(<Harness disabled />);
    fireEvent.drop(screen.getByTestId('drop'), {
      dataTransfer: { files: [new File([], 'final.stpkg')] },
    });
    expect(open).not.toHaveBeenCalled();
    expect(invalid).not.toHaveBeenCalled();
  });
  it('ignores text dragged within the launcher without reporting a package error', () => {
    render(<Harness />);
    fireEvent.dragEnter(screen.getByTestId('drop'), {
      dataTransfer: { items: [{ kind: 'string' }], types: ['text/plain'] },
    });
    fireEvent.drop(screen.getByTestId('drop'), {
      dataTransfer: { files: [], types: ['text/plain'] },
    });
    expect(open).not.toHaveBeenCalled();
    expect(invalid).not.toHaveBeenCalled();
    expect(resolveDroppedPackagePath).not.toHaveBeenCalled();
  });
});
