export interface CorrelationLogger {
  debug: (message: string, payload?: unknown) => void;
  warn: (message: string, payload?: unknown) => void;
}

export const noopCorrelationLogger: CorrelationLogger = {
  debug: () => undefined,
  warn: () => undefined,
};
