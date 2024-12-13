import { EventEmitter } from "events";
import { PoolClient } from "pg";
import { sourcePool, targetPool } from "../../config/database";
import { SyncConfig, TableConfig } from "../../types";
import { MetadataService } from "../metadata/metadataService";
import { DataSyncService } from "./dataSyncService";
import { TableManagementService } from "../table/tableManagementService";

class SyncService extends EventEmitter {
  private metadataService: MetadataService;
  private dataSyncService: DataSyncService;
  private tableManagementService: TableManagementService;

  constructor(private config: SyncConfig, private batchSize: number = 1000) {
    super();
    this.metadataService = new MetadataService();
    this.dataSyncService = new DataSyncService();
    this.tableManagementService = new TableManagementService();
  }

  async syncTable(tableName: string): Promise<void> {
    const client: PoolClient = await targetPool.connect();
    const tableConfig = this.getTableConfig(tableName);
    const primaryKeys = Array.isArray(tableConfig.primaryKey)
      ? tableConfig.primaryKey
      : [tableConfig.primaryKey];

    try {
      await client.query("SET statement_timeout = 300000");
      await client.query("BEGIN");

      await this.tableManagementService.createTableIfNotExists(
        client,
        tableName,
        tableConfig
      );

      const cleanupCount = await this.cleanupExtraRecords(
        client,
        tableName,
        primaryKeys,
        tableConfig
      );

      const beforeCount = await client.query(
        `SELECT COUNT(*) FROM ${tableName}`
      );

      const lastSyncTime = await this.metadataService.getLastSyncTime(
        tableName
      );

      const totalCount = await this.dataSyncService.getSourceCount(
        tableName,
        lastSyncTime,
        tableConfig
      );

      if (totalCount > 0) {
        await this.processBatches(
          client,
          tableName,
          tableConfig,
          lastSyncTime,
          totalCount
        );

        await this.metadataService.updateLastSyncTime(client, tableName);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async processBatches(
    client: PoolClient,
    tableName: string,
    tableConfig: TableConfig,
    lastSyncTime: Date,
    totalCount: number
  ): Promise<void> {
    const batchSize = tableConfig.batchSize || this.batchSize;
    const primaryKeys = Array.isArray(tableConfig.primaryKey)
      ? tableConfig.primaryKey
      : [tableConfig.primaryKey];

    for (let offset = 0; offset < totalCount; offset += batchSize) {
      const records = await this.dataSyncService.getSourceDataBatch(
        tableName,
        tableConfig,
        offset,
        batchSize,
        lastSyncTime
      );

      if (records.length > 0) {
        await this.dataSyncService.upsertBatch(
          client,
          tableName,
          primaryKeys,
          records,
          tableConfig
        );
        this.emit("progress", {
          table: tableName,
          processed: offset + records.length,
          total: totalCount,
          progress: ((offset + records.length) / totalCount) * 100,
        });
      }
    }
  }

  private getTableConfig(tableName: string): TableConfig {
    const tableConfig = this.config.tables.find((t) => t.name === tableName);
    if (!tableConfig) {
      throw new Error(`Table ${tableName} not found in config`);
    }
    return tableConfig;
  }

  private async cleanupExtraRecords(
    client: PoolClient,
    tableName: string,
    primaryKeys: string[],
    tableConfig: TableConfig
  ): Promise<number> {
    const sourceTable = this.getFullTableName(
      this.getSourceTableName(tableName),
      tableConfig.sourceSchema
    );
    const targetTable = this.getFullTableName(
      tableName,
      tableConfig.targetSchema
    );

    // Get all primary keys from source
    const sourceQuery = `
      SELECT ${primaryKeys.join(", ")} 
      FROM ${sourceTable}
    `;
    const sourceResult = await sourcePool.query(sourceQuery);

    // Format source keys as tuples for IN clause
    const sourceKeys = sourceResult.rows.map(
      (row) => `(${primaryKeys.map((pk) => `'${row[pk]}'`).join(",")})`
    );

    if (sourceKeys.length === 0) {
      return 0;
    }

    // Delete records from target that don't exist in source
    const deleteQuery = `
      DELETE FROM ${targetTable} t
      WHERE (${primaryKeys.map((pk) => `t.${pk}`).join(",")}) 
      NOT IN (${sourceKeys.join(",")})
      RETURNING *;
    `;

    const deleteResult = await client.query(deleteQuery);
    return deleteResult.rowCount || 0;
  }

  private getSourceTableName(targetTableName: string): string {
    const tableConfig = this.getTableConfig(targetTableName);
    return tableConfig.sourceName || targetTableName;
  }

  private getFullTableName(
    tableName: string,
    schema: string | undefined
  ): string {
    return schema ? `${schema}.${tableName}` : tableName;
  }
}

export default SyncService;
