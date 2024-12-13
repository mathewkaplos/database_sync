import logger from "./logger";
import { sourcePool, targetPool } from "../config/database";
import SyncJob from "../jobs/syncJob";

export class ShutdownManager {
  constructor(private syncJob: SyncJob) {}

  async shutdown(): Promise<void> {
    try {
      logger.info("Initiating graceful shutdown...");

      const shutdownTimeout = setTimeout(() => {
        logger.error("Forced shutdown due to timeout");
        process.exit(1);
      }, 10000);

      await this.syncJob.stop();
      await Promise.all([sourcePool.end(), targetPool.end()]);

      clearTimeout(shutdownTimeout);
      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error(
        `Error during shutdown: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      process.exit(1);
    }
  }
}
