import { PoolClient } from "pg";
import { TableValidationResult } from "../types";
import logger from "../../../utils/logger";

export async function validateTableExists(
  client: PoolClient,
  schema: string,
  tableName: string
): Promise<TableValidationResult> {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      );
    `;
    const { rows } = await client.query(query, [schema, tableName]);
    const exists = rows[0]?.exists || false;

    return {
      exists,
      message: exists
        ? `Table "${schema}"."${tableName}" exists`
        : `Table "${schema}"."${tableName}" does not exist`,
    };
  } catch (error) {
    logger.error(`Error validating table ${schema}.${tableName}:`, error);
    throw error;
  }
}
