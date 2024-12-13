import { PoolClient } from "pg";
import logger from "../../../utils/logger";

export async function validateSchema(
  client: PoolClient,
  schema: string
): Promise<boolean> {
  try {
    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = $1;
    `;
    const { rows } = await client.query(query, [schema]);
    return rows.length > 0;
  } catch (error) {
    logger.error(`Error validating schema ${schema}:`, error);
    return false;
  }
}

export async function createSchemaIfNotExists(
  client: PoolClient,
  schema: string
): Promise<void> {
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    logger.info(`Schema "${schema}" created/verified successfully`);
  } catch (error) {
    logger.error(`Failed to create schema ${schema}:`, error);
    throw error;
  }
}
