import { Request, Response } from "express";
import SyncService from "../services/sync/syncService";
import syncConfig from "../config/syncConfig";
import logger from "../utils/logger";
import { SyncError } from "../types/errors";
import { targetPool, sourcePool } from "../config/database";

class SyncController {
  private syncService: SyncService;

  constructor() {
    this.syncService = new SyncService(syncConfig);

    this.syncService.on("progress", (progress) => {
      logger.info(
        `Sync progress for ${progress.table}: ${progress.progress.toFixed(2)}%`
      );
    });
  }

  async syncTable(req: Request, res: Response): Promise<void> {
    const { tableName } = req.params;

    try {
      logger.info(`Starting sync for table: ${tableName}`);

      await this.syncService.syncTable(tableName);

      res.json({
        status: "success",
        message: `Sync completed for table: ${tableName}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        `Sync failed for table ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (error instanceof SyncError) {
        res.status(400).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Internal server error during sync",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  async syncAllTables(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Starting sync for all tables");

      const tables = syncConfig.tables.map((table) => table.name);
      await Promise.all(
        tables.map((tableName: string) => this.syncService.syncTable(tableName))
      );

      res.json({
        status: "success",
        message: "Sync completed for all tables",
        tables,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        `Sync failed for all tables: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      res.status(500).json({
        status: "error",
        message: "Internal server error during sync",
        timestamp: new Date().toISOString(),
      });
    }
  }

  async manualSync(req: Request, res: Response): Promise<void> {
    try {
      let tables = req.body.tables;

      // If no tables specified, use all tables from syncConfig
      if (!tables) {
        tables = syncConfig.tables.map((table) => table.name);
        logger.info("No tables specified, using all configured tables");
      } else if (!Array.isArray(tables)) {
        res.status(400).json({
          status: "error",
          message: "If specified, tables must be an array of table names",
          example: { tables: ["table1", "table2"] },
        });
        return;
      }

      if (tables.length === 0) {
        res.status(400).json({
          status: "error",
          message: "No tables found to sync",
        });
        return;
      }

      logger.info(`Starting manual sync for tables: ${JSON.stringify(tables)}`);
      await Promise.all(
        tables.map((tableName: string) => this.syncService.syncTable(tableName))
      );

      res.json({
        status: "success",
        message: "Manual sync completed",
        tables,
        timestamp: this.getEATTimestamp(),
      });
    } catch (error) {
      logger.error(
        `Manual sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: "Manual sync failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async manualSyncOne(req: Request, res: Response): Promise<void> {
    try {
      const { table } = req.params;

      if (!table) {
        res.status(400).json({
          status: "error",
          message: "Table name is required",
        });
        return;
      }

      await this.syncService.syncTable(table);

      res.json({
        status: "success",
        message: "Manual sync completed",
        table,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        `Manual sync failed for table ${req.params.table}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: "Manual sync failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async cleanupTable(req: Request, res: Response): Promise<void> {
    const { tableName } = req.params;
    try {
      // Get a client with transaction
      const client = await targetPool.connect();
      try {
        await client.query("BEGIN");
        const query = `TRUNCATE TABLE ${tableName};`;
        await client.query(query);
        await client.query("COMMIT");

        // Verify the truncate
        const verifyQuery = `SELECT COUNT(*) FROM ${tableName}`;
        const verifyResult = await client.query(verifyQuery);

        res.json({
          status: "success",
          message: `Table ${tableName} cleaned up successfully`,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(
        `Cleanup failed for ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: `Failed to cleanup table ${tableName}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async compareData(req: Request, res: Response): Promise<void> {
    const { tableName } = req.params;
    try {
      const sourceQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
      const targetQuery = `SELECT COUNT(*) as count FROM ${tableName}`;

      const [sourceResult, targetResult] = await Promise.all([
        sourcePool.query(sourceQuery),
        targetPool.query(targetQuery),
      ]);

      const comparison = {
        source: parseInt(sourceResult.rows[0].count),
        target: parseInt(targetResult.rows[0].count),
        difference:
          parseInt(sourceResult.rows[0].count) -
          parseInt(targetResult.rows[0].count),
      };

      res.json({
        status: "success",
        comparison,
      });
    } catch (error) {
      logger.error(
        `Data comparison failed for ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: `Failed to compare data for ${tableName}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async showTableData(req: Request, res: Response): Promise<void> {
    const { tableName } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    try {
      const query = `
        SELECT *, 
          CASE 
            WHEN updated_at IS NOT NULL 
            THEN updated_at AT TIME ZONE 'EAT'
            ELSE NULL 
          END as updated_at_eat
        FROM ${tableName}
        ORDER BY 1
        LIMIT $1 OFFSET $2
      `;

      const [sourceData, targetData] = await Promise.all([
        sourcePool.query(query, [limit, offset]),
        targetPool.query(query, [limit, offset]),
      ]);

      res.json({
        status: "success",
        data: {
          source: sourceData.rows,
          target: targetData.rows,
        },
      });
    } catch (error) {
      logger.error(
        `Failed to fetch table data for ${tableName}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: `Failed to fetch table data for ${tableName}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async checkMetadata(req: Request, res: Response): Promise<void> {
    try {
      const query = "SELECT * FROM sync_metadata ORDER BY table_name";
      const result = await targetPool.query(query);

      res.json({
        status: "success",
        metadata: result.rows,
      });
    } catch (error) {
      logger.error(
        `Failed to check metadata: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: "Failed to check metadata",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async checkTableExists(req: Request, res: Response): Promise<void> {
    const { table } = req.query;
    if (!table) {
      res.status(400).json({
        status: "error",
        message: "table parameter is required",
      });
      return;
    }

    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;

      const [sourceExists, targetExists] = await Promise.all([
        sourcePool.query(query, [table]),
        targetPool.query(query, [table]),
      ]);

      res.json({
        status: "success",
        exists: {
          source: sourceExists.rows[0].exists,
          target: targetExists.rows[0].exists,
        },
      });
    } catch (error) {
      logger.error(
        `Failed to check table existence: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(500).json({
        status: "error",
        message: "Failed to check table existence",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Helper function to get EAT timestamp
  private getEATTimestamp(): string {
    const date = new Date();
    date.setHours(date.getHours() + 3); // EAT is UTC+3
    return date.toISOString();
  }
}

export default SyncController;
