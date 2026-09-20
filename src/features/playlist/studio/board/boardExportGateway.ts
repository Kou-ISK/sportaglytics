export const exportTacticalBoardPng = async (
  svg: SVGSVGElement,
): Promise<void> => {
  const api = window.electronAPI;
  if (!api)
    throw new Error('画像の保存にはデスクトップアプリを使用してください。');
  const path = await api.saveFileDialog('tactical-board.png', [
    { name: 'PNG画像', extensions: ['png'] },
  ]);
  if (!path) return;
  const clone = svg.cloneNode(true);
  if (!(clone instanceof SVGSVGElement))
    throw new Error('戦術盤を読み込めませんでした。');
  const ratio = svg.viewBox.baseVal.width / svg.viewBox.baseVal.height;
  clone.setAttribute('width', String(Math.round(1600 * ratio)));
  clone.setAttribute('height', '1600');
  clone.style.width = '';
  clone.style.height = '';
  clone.style.maxHeight = '';
  clone.style.minHeight = '';
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml',
    }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('戦術盤の画像を作成できませんでした。'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(1600 * ratio);
    canvas.height = 1600;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像を作成できませんでした。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const saved = await api.writeBinaryFile(
      path,
      canvas.toDataURL('image/png').split(',')[1],
    );
    if (!saved)
      throw new Error('保存できませんでした。保存先を変更してください。');
  } finally {
    URL.revokeObjectURL(url);
  }
};
