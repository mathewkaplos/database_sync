import { Request, Response } from "express";
import { sourcePool, targetPool } from "../config/database";
import logger from "../utils/logger";

class HealthController {
  async check(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const sourceHealth = await sourcePool.query("SELECT 1");
      const targetHealth = await targetPool.query("SELECT 1");
      const responseTime = Date.now() - startTime;

      const memoryUsage = process.memoryUsage();

      res.json({
        status: "healthy",
        databases: {
          source: sourceHealth.rows.length === 1,
          target: targetHealth.rows.length === 1,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          memory: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        `Health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      res.status(503).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default HealthController;
