import { Pool } from "pg";
import dotenv from "dotenv";
import logger from "../../src/utils/logger";

dotenv.config();

interface DatabaseConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
  schema?: string;
}

interface PoolConfig extends DatabaseConfig {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxUses?: number;
}

const defaultPoolConfig: Partial<PoolConfig> = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxUses: 7500,
};

function createPool(config: PoolConfig): Pool {
  return new Pool({
    ...defaultPoolConfig,
    ...config,
  });
}

const sourceConfig: DatabaseConfig = {
  user: process.env.SOURCE_DB_USER!,
  password: process.env.SOURCE_DB_PASSWORD!,
  host: process.env.SOURCE_DB_HOST!,
  port: parseInt(process.env.SOURCE_DB_PORT || "5432"),
  database: process.env.SOURCE_DB_NAME!,
  schema: process.env.SOURCE_DB_SCHEMA,
};

const targetConfig: DatabaseConfig = {
  user: process.env.TARGET_DB_USER!,
  password: process.env.TARGET_DB_PASSWORD!,
  host: process.env.TARGET_DB_HOST!,
  port: parseInt(process.env.TARGET_DB_PORT || "5432"),
  database: process.env.TARGET_DB_NAME!,
  schema: process.env.TARGET_DB_SCHEMA,
};

function validateEnvVars() {
  const required = [
    "SOURCE_DB_USER",
    "SOURCE_DB_PASSWORD",
    "SOURCE_DB_HOST",
    "SOURCE_DB_NAME",
    "TARGET_DB_USER",
    "TARGET_DB_PASSWORD",
    "TARGET_DB_HOST",
    "TARGET_DB_NAME",
  ];

  const missing = required.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// Call this before creating pools
validateEnvVars();

export const sourcePool = createPool(sourceConfig);
export const targetPool = createPool(targetConfig);

export const getSourceClient = async () => {
  return await sourcePool.connect();
};

export const getTargetClient = async () => {
  return await targetPool.connect();
};

// Add error handlers
sourcePool.on("error", (err) => {
  logger.error(`Source pool error: ${err.message}`);
});

targetPool.on("error", (err) => {
  logger.error(`Target pool error: ${err.message}`);
});
