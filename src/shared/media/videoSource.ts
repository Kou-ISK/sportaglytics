export const formatSource = (src: string): string => {
  const trimmed = src.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;

  if (/^\\\\/.test(trimmed)) {
    const replaced = trimmed.replace(/\\/g, '/').replace(/^\/+/g, '');
    const [server, ...parts] = replaced.split('/');
    return `file://${server}/${parts.map(encodeURIComponent).join('/')}`;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const replaced = trimmed.replace(/\\/g, '/');
    const [drive, ...parts] = replaced.split('/');
    return `file:///${drive}/${parts.map(encodeURIComponent).join('/')}`;
  }

  const normalised = trimmed.replace(/^\/+/g, '');
  return `file:///${normalised.split('/').map(encodeURIComponent).join('/')}`;
};

export const resolveVideoSource = (
  src: string,
): { src: string; type: 'video/mp4' | 'video/youtube' } => {
  const formatted = formatSource(src);
  const isYoutube = /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(
    formatted,
  );
  return {
    src: formatted,
    type: isYoutube ? 'video/youtube' : 'video/mp4',
  };
};
