// Electron applies the native size before Chromium necessarily repositions an
// open tooltip. Wait for that specific transition, not for the document under
// test to pass its independent horizontal-overflow assertion.
export const resizeTimelineReviewWindow = async (app, page, width, height) => {
  const nativeWindow = await app.browserWindow(page);
  const contentSize = await nativeWindow.evaluate(
    (window, [w, h]) => {
      window.setSize(w, h);
      return window.getContentSize();
    },
    [width, height],
  );
  await page.waitForFunction(
    ([w, h]) =>
      innerWidth === w &&
      innerHeight === h &&
      Array.from(document.querySelectorAll('[role="tooltip"]')).every((tip) => {
        const bounds = tip.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= w;
      }),
    contentSize,
    { polling: 'raf', timeout: 3000 },
  );
};
