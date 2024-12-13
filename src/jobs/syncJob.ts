import { CronJob } from "cron";
import logger from "../utils/logger";
import SyncService from "../services/sync/syncService";
import syncConfig from "../config/syncConfig";

class SyncJob {
  private job: CronJob;
  private syncService: SyncService;

  constructor(cronSchedule: string) {
    this.syncService = new SyncService(syncConfig);
    this.job = new CronJob(cronSchedule, this.runSync.bind(this));
  }

  private async runSync(): Promise<void> {
    try {
      logger.info("Starting scheduled sync job");
      const tables = syncConfig.tables.map((table) => table.name);

      for (const tableName of tables) {
        await this.syncService.syncTable(tableName);
      }

      logger.info("Scheduled sync job completed");
    } catch (error) {
      logger.error(
        `Scheduled sync job failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async start(): Promise<void> {
    this.job.start();
    logger.info("Sync job scheduler started");
  }

  async stop(): Promise<void> {
    this.job.stop();
    logger.info("Sync job scheduler stopped");
  }
}

export default SyncJob;
