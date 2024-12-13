declare module "../utils/logger" {
  interface Logger {
    info(message: string): void;
    error(message: string): void;
    warn(message: string): void;
    debug(message: string): void;
  }

  const logger: Logger;
  export default logger;
}
