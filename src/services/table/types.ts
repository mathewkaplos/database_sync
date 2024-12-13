import { PoolClient } from "pg";

export interface ColumnDefinition {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string;
  column_default: string | null;
}

export interface SchemaConfig {
  sourceSchema: string;
  targetSchema: string;
  sourceName?: string;
}

export interface TableValidationResult {
  exists: boolean;
  message: string;
}