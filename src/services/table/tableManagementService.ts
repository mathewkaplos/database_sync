import { PoolClient } from "pg";
import { TableConfig } from "../../types";
import { ColumnDefinition, SchemaConfig } from "./types";
import { generateColumnDefinition } from "./utils/sqlGenerators";
import {
  validateSchema,
  createSchemaIfNotExists,
} from "./validators/schemaValidator";
import { validateTableExists } from "./validators/tableValidator";
import logger from "../../utils/logger";
import { sourcePool, getSourceClient } from "../../config/database";

export class TableManagementService {
  private async getSourceTableStructure(
    schema: string,
    tableName: string
  ): Promise<ColumnDefinition[]> {
    const schemaQuery = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = $1 
      AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const { rows } = await sourcePool.query(schemaQuery, [schema, tableName]);
    console.log("rows", rows);
    return rows;
  }

  private async addPrimaryKeyConstraint(
    client: PoolClient,
    targetSchema: string,
    tableName: string,
    primaryKeys: string[]
  ): Promise<void> {
    const constraintName = `${tableName}_pkey`;

    const { rows } = await client.query(
      `
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = $1
      AND table_name = $2
      AND constraint_name = $3;
    `,
      [targetSchema, tableName, constraintName]
    );

    if (rows.length === 0) {
      const pkSQL = `
        ALTER TABLE "${targetSchema}"."${tableName}"
        ADD CONSTRAINT "${constraintName}" 
        PRIMARY KEY (${primaryKeys.map((pk) => `"${pk}"`).join(", ")});
      `;
      await client.query(pkSQL);
      logger.info(
        `Primary key constraint added to ${targetSchema}.${tableName}`
      );
    }
  }

  async createTableIfNotExists(
    client: PoolClient,
    tableName: string,
    tableConfig: TableConfig
  ): Promise<void> {
    const schemaConfig: SchemaConfig = {
      targetSchema:
        tableConfig.targetSchema || process.env.TARGET_DB_SCHEMA || "public",
      sourceSchema:
        tableConfig.sourceSchema || process.env.SOURCE_DB_SCHEMA || "public",
      sourceName: tableConfig.sourceName,
    };

    try {
      // Validate source schema and table
      const sourceClient = await getSourceClient();
      const sourceExists = await validateSchema(
        sourceClient,
        schemaConfig.sourceSchema
      );
      if (!sourceExists) {
        throw new Error(
          `Source schema "${schemaConfig.sourceSchema}" does not exist`
        );
      }

      const sourceTableValidation = await validateTableExists(
        sourceClient,
        schemaConfig.sourceSchema,
        tableConfig.sourceName || tableName
      );
      if (!sourceTableValidation.exists) {
        throw new Error(sourceTableValidation.message);
      }

      // Create target schema if needed
      await createSchemaIfNotExists(client, schemaConfig.targetSchema);

      // Get source table structure
      const columns = await this.getSourceTableStructure(
        schemaConfig.sourceSchema,
        tableConfig.sourceName || tableName
      );

      if (columns.length === 0) {
        throw new Error(`Source table has no columns`);
      }

      // Create table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "${
          schemaConfig.targetSchema
        }"."${tableName}" (
          ${columns.map(generateColumnDefinition).join(",\n          ")}
        );
      `;

      await client.query(createTableSQL);
      logger.info(`Table structure created successfully`);

      // Add primary key if specified
      if (tableConfig.primaryKey) {
        const primaryKeys = Array.isArray(tableConfig.primaryKey)
          ? tableConfig.primaryKey
          : [tableConfig.primaryKey];

        await this.addPrimaryKeyConstraint(
          client,
          schemaConfig.targetSchema,
          tableName,
          primaryKeys
        );
      }

      logger.info(
        `Table "${schemaConfig.targetSchema}"."${tableName}" created/verified successfully`
      );
    } catch (error) {
      logger.error(
        `Failed to create/verify table "${schemaConfig.targetSchema}"."${tableName}"`
      );
      logger.error("Error details:", error);
      throw error;
    }
  }
}
