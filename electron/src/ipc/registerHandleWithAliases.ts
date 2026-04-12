import { ipcMain, type IpcMainInvokeEvent } from 'electron';

type IpcInvokeHandler<Args extends unknown[], Result> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => Result | Promise<Result>;

export const registerHandleWithAliases = <Result>(
  channel: string,
  aliases: string[],
  handler: IpcInvokeHandler<unknown[], Result>,
): void => {
  const invokeHandler = (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Result | Promise<Result> => {
    return handler(event, ...args);
  };
  ipcMain.handle(channel, invokeHandler);
  aliases.forEach((alias) => {
    ipcMain.handle(alias, invokeHandler);
  });
};
