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

export interface TableConfig {
  name: string;
  sourceName?: string;
  sourceSchema?: string;
  targetSchema?: string;
  primaryKey: string | string[];
  batchSize?: number;
  changeDetection: {
    timestampColumn: string;
    trackDeletes?: boolean;
  };
}

export interface SyncConfig {
  batchSize: number;
  tables: TableConfig[];
  retryAttempts: number;
  retryDelay: number;
}

export interface SyncStatus {
  status: "running" | "completed" | "failed";
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  error?: string;
}

export interface ProgressEvent {
  table: string;
  progress: number;
  processed: number;
  total: number;
}

export interface DatabaseRecord {
  [key: string]: any;
  updated_at: Date;
}

export interface ComparisonResult {
  record_key: string;
  status: "missing_in_source" | "missing_in_target" | "different";
  records: DatabaseRecord[];
}
