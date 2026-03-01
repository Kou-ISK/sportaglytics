import { BrowserWindow, IpcMainEvent, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';

interface RegisterReportHandlersOptions {
  mainURL: string;
  preloadPath: string;
  applyWindowSecurity: (window: BrowserWindow) => void;
}

let isRegistered = false;

export const registerReportHandlers = ({
  mainURL,
  preloadPath,
  applyWindowSecurity,
}: RegisterReportHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'write-pdf-file-from-html',
    async (_event, filePath: string, html: string) => {
      let printWindow: BrowserWindow | null = null;
      try {
        printWindow = new BrowserWindow({
          show: false,
          width: 1200,
          height: 1600,
          webPreferences: {
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
          },
        });
        applyWindowSecurity(printWindow);

        const htmlDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
          html,
        )}`;
        await printWindow.loadURL(htmlDataUrl);

        await printWindow.webContents.executeJavaScript(
          `new Promise((resolve) => {
            const done = () => setTimeout(resolve, 120);
            const images = Array.from(document.images || []);
            if (images.length === 0) {
              done();
              return;
            }
            let remaining = images.length;
            const onFinish = () => {
              remaining -= 1;
              if (remaining <= 0) done();
            };
            images.forEach((img) => {
              if (img.complete) {
                onFinish();
              } else {
                img.addEventListener('load', onFinish, { once: true });
                img.addEventListener('error', onFinish, { once: true });
              }
            });
          })`,
          true,
        );

        const pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
        });
        await fs.writeFile(filePath, pdfBuffer);
        return true;
      } catch (error) {
        console.error('Failed to write PDF from HTML:', error);
        return false;
      } finally {
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.destroy();
        }
      }
    },
  );

  ipcMain.handle(
    'analysis-report:print-pdf',
    async (_event, filePath: string, payload: unknown) => {
      let printWindow: BrowserWindow | null = null;
      const requestId = `analysis-report-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      let cleanupRenderReadyListener: (() => void) | undefined;

      try {
        printWindow = new BrowserWindow({
          show: false,
          width: 1400,
          height: 1800,
          webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            backgroundThrottling: false,
          },
        });
        applyWindowSecurity(printWindow);

        const waitForRenderReady = () =>
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              if (cleanupRenderReadyListener) {
                cleanupRenderReadyListener();
              }
              reject(
                new Error('Timed out waiting for analysis report render-ready'),
              );
            }, 20_000);

            const listener = (
              event: IpcMainEvent,
              receivedRequestId?: string,
            ) => {
              if (!printWindow || printWindow.isDestroyed()) return;
              if (event.sender !== printWindow.webContents) return;
              if (receivedRequestId !== requestId) return;
              if (cleanupRenderReadyListener) {
                cleanupRenderReadyListener();
              }
              resolve();
            };

            cleanupRenderReadyListener = () => {
              clearTimeout(timeout);
              ipcMain.removeListener('analysis-report:render-ready', listener);
              cleanupRenderReadyListener = undefined;
            };

            ipcMain.on('analysis-report:render-ready', listener);
          });

        const readyPromise = waitForRenderReady();
        const reportUrl = `${mainURL}#/analysis-report?requestId=${encodeURIComponent(
          requestId,
        )}`;
        await printWindow.loadURL(reportUrl);

        printWindow.webContents.send('analysis-report:payload', {
          requestId,
          payload,
        });
        const payloadRetryTimer = setTimeout(() => {
          if (printWindow && !printWindow.isDestroyed()) {
            printWindow.webContents.send('analysis-report:payload', {
              requestId,
              payload,
            });
          }
        }, 350);

        await readyPromise;
        clearTimeout(payloadRetryTimer);

        const pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
        });
        await fs.writeFile(filePath, pdfBuffer);
        return true;
      } catch (error) {
        console.error('Failed to print analysis report PDF:', error);
        return false;
      } finally {
        if (cleanupRenderReadyListener) {
          cleanupRenderReadyListener();
        }
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.destroy();
        }
      }
    },
  );
};
