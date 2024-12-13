import dotenv from "dotenv";
import { createServer } from "./server/server";
import SyncJob from "./jobs/syncJob";
import logger from "./utils/logger";
import { ShutdownManager } from "./utils/shutdownManager";

// Load environment variables
dotenv.config();

const port = process.env.PORT || 3000;
const app = createServer();
const syncJob = new SyncJob(process.env.SYNC_INTERVAL || "* * * * *");
const shutdownManager = new ShutdownManager(syncJob);

// Start the server and sync job
const startServer = async (): Promise<void> => {
  try {
    await syncJob.start();
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info("Initializing sync job service");
    });
  } catch (error) {
    logger.error(
      `Failed to start application: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => shutdownManager.shutdown());
process.on("SIGINT", () => shutdownManager.shutdown());

// Start the server
startServer();

export default app;
