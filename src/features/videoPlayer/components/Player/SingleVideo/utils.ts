export const formatSource = (src: string) => {
  const trimmed = src.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;

  if (/^\\\\/.test(trimmed)) {
    const replaced = trimmed.replace(/\\/g, '/').replace(/^\/+/g, '');
    return `file://${encodeURI(replaced)}`;
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    const replaced = trimmed.replace(/\\/g, '/');
    return `file:///${encodeURI(replaced)}`;
  }

  const normalised = trimmed.replace(/\\/g, '/').replace(/^\/+/g, '');
  return `file:///${encodeURI(normalised)}`;
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
