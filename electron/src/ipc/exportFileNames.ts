/** Keep each component short enough for combined names on NTFS and APFS. */
export const portableExportStem = (value: string): string => {
  const normalized = Array.from(value.trim())
    .map((character) =>
      character.charCodeAt(0) < 32 || /[\s/\\:*?"<>|]/.test(character)
        ? '_'
        : character,
    )
    .reduce(
      (name, character) =>
        Buffer.byteLength(name + character, 'utf8') <= 100
          ? name + character
          : name,
      '',
    )
    .replace(/[. ]+$/g, '');
  const name = normalized || 'export';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    ? `_${name}`
    : name;
};

export const createExportNameAllocator = (): ((name: string) => string) => {
  const used = new Set<string>();
  return (name) => {
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = name.replace(/\.mp4$/i, `_${suffix}.mp4`);
      suffix += 1;
    }
    used.add(candidate.toLocaleLowerCase());
    return candidate;
  };
};
