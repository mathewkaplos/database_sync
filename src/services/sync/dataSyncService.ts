import { PoolClient } from "pg";
import { DatabaseRecord } from "../../types";
import { sourcePool, targetPool } from "../../config/database";
import { TableConfig } from "../../types";

export class DataSyncService {
  private getSchemaName(schema: string | undefined, envVar: string): string {
    return schema || process.env[envVar] || "public";
  }

  private getFullTableName(
    tableName: string,
    configSchema: string | undefined,
    envVar: string
  ): string {
    const schema = this.getSchemaName(configSchema, envVar);
    return `${schema}.${tableName}`;
  }

  async getSourceCount(
    tableName: string,
    lastSyncTime: Date,
    tableConfig: TableConfig
  ): Promise<number> {
    const sourceTable = this.getFullTableName(
      tableConfig.sourceName || tableName,
      tableConfig.sourceSchema,
      "SOURCE_DB_SCHEMA"
    );
    const query = `
      SELECT COUNT(*)
      FROM ${sourceTable} s
      WHERE s.${tableConfig.changeDetection.timestampColumn} > $1
    `;

    const { rows } = await sourcePool.query<{ count: string }>(query, [
      lastSyncTime,
    ]);
    return parseInt(rows[0]?.count || "0");
  }

  async getSourceDataBatch(
    tableName: string,
    tableConfig: TableConfig,
    offset: number,
    limit: number,
    lastSyncTime: Date
  ): Promise<DatabaseRecord[]> {
    const sourceTable = this.getFullTableName(
      tableConfig.sourceName || tableName,
      tableConfig.sourceSchema,
      "SOURCE_DB_SCHEMA"
    );
    const primaryKeys = Array.isArray(tableConfig.primaryKey)
      ? tableConfig.primaryKey
      : [tableConfig.primaryKey];

    const query = `
      SELECT s.*
      FROM ${sourceTable} s
      WHERE s.${tableConfig.changeDetection.timestampColumn} > $1
      ORDER BY ${primaryKeys.join(", ")}
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await sourcePool.query<DatabaseRecord>(query, [
      lastSyncTime,
      limit,
      offset,
    ]);

    return rows;
  }

  async upsertBatch(
    client: PoolClient,
    tableName: string,
    primaryKeys: string[],
    records: DatabaseRecord[],
    tableConfig: TableConfig
  ): Promise<void> {
    if (!records.length) return;

    const targetTable = this.getFullTableName(
      tableName,
      tableConfig.targetSchema,
      "TARGET_DB_SCHEMA"
    );
    const columns = Object.keys(records[0]).filter(
      (col) => col !== "row_checksum" && col !== "sync_action"
    );
    const placeholderGroups: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    records.forEach((record) => {
      const placeholders = columns.map(() => `$${valueCount++}`);
      placeholderGroups.push(`(${placeholders.join(", ")})`);
      values.push(
        ...columns.map((col) => {
          const value = record[col];
          return value;
        })
      );
    });

    const updateSet = columns
      .filter((col) => !primaryKeys.includes(col))
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(", ");

    const query = `
      INSERT INTO ${targetTable} (${columns.join(", ")})
      VALUES ${placeholderGroups.join(", ")}
      ON CONFLICT (${primaryKeys.join(", ")})
      DO UPDATE SET ${updateSet}
      RETURNING ${primaryKeys.join(", ")}
    `;

    const result = await client.query(query, values);
  }
}
