export interface ControlPipe {
  readonly inputFd: number;
  closeReader(): void;
  write(value: string): Promise<void>;
  close(): Promise<void>;
}
export function createControlPipe(file: string): ControlPipe;
