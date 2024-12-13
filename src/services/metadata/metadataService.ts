import { PoolClient } from "pg";
import logger from "../../utils/logger";
import { targetPool } from "../../config/database";

export class MetadataService {
  private schema: string;

  constructor() {
    this.schema = process.env.TARGET_DB_SCHEMA || "public";
  }

  private getSchemaName(): string {
    return process.env.TARGET_DB_SCHEMA || "public";
  }

  private getFullTableName(tableName: string): string {
    const schema = this.getSchemaName();
    return `${schema}.${tableName}`;
  }

  async createMetadataTable(): Promise<void> {
    try {
      // First verify schema exists
      const schemaCheck = await targetPool.query(
        `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata 
          WHERE schema_name = $1
        );
      `,
        [this.schema]
      );

      if (!schemaCheck.rows[0].exists) {
        logger.info(`Creating schema ${this.schema}`);
        await targetPool.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema};`);
      }

      await targetPool.query(
        `DROP TABLE IF EXISTS ${this.getFullTableName("sync_metadata")};`
      );

      const createQuery = `
        CREATE TABLE ${this.getFullTableName("sync_metadata")} (
          table_name TEXT PRIMARY KEY,
          last_sync_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
      `;

      await targetPool.query(createQuery);
      logger.info("Metadata table created successfully");
    } catch (error) {
      logger.error(
        `Failed to create metadata table: ${
          error instanceof Error ? error.stack : String(error)
        }`
      );
      throw error;
    }
  }

  async getLastSyncTime(tableName: string): Promise<Date> {
    try {
      await this.initializeSyncMetadata(tableName);
      const query = `
        SELECT to_char(last_sync_time - interval '30 min', 'YYYY-MM-DD HH24:MI:SS.MS') as last_sync_time
        FROM ${this.getFullTableName("sync_metadata")}
        WHERE table_name = $1
      `;
      const { rows } = await targetPool.query<{ last_sync_time: string }>(
        query,
        [tableName]
      );

      if (!rows[0]?.last_sync_time) {
        return new Date(0);
      }

      return new Date(rows[0].last_sync_time);
    } catch (error) {
      logger.error(
        `Error getting last sync time: ${
          error instanceof Error ? error.stack : String(error)
        }`
      );
      await this.createMetadataTable();
      await this.initializeSyncMetadata(tableName);
      return new Date(0);
    }
  }

  async updateLastSyncTime(
    client: PoolClient,
    tableName: string
  ): Promise<void> {
    const query = `
      INSERT INTO ${this.getFullTableName(
        "sync_metadata"
      )} (table_name, last_sync_time)
      VALUES ($1, CURRENT_TIMESTAMP)
      ON CONFLICT (table_name) DO UPDATE 
      SET last_sync_time = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    await client.query(query, [tableName]);
  }

  private async initializeSyncMetadata(tableName: string): Promise<void> {
    const query = `
      INSERT INTO ${this.getFullTableName(
        "sync_metadata"
      )} (table_name, last_sync_time)
      VALUES ($1, '2000-01-01'::timestamp)
      ON CONFLICT (table_name) DO NOTHING
      RETURNING *;
    `;
    await targetPool.query(query, [tableName]);
  }
}
