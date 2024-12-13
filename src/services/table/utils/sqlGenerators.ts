import { ColumnDefinition } from "../types";

export function generateColumnDefinition(col: ColumnDefinition): string {
  const parts = [];
  parts.push(`"${col.column_name}"`);

  // Handle data types
  const dataType = mapDataType(col);
  parts.push(dataType);

  // Add nullability
  if (col.is_nullable === 'NO') {
    parts.push('NOT NULL');
  }

  // Add default if exists
  if (col.column_default !== null) {
    parts.push(`DEFAULT ${col.column_default}`);
  }

  return parts.join(' ');
}

export function mapDataType(col: ColumnDefinition): string {
  switch (col.data_type) {
    case 'character varying':
      return col.character_maximum_length
        ? `varchar(${col.character_maximum_length})`
        : 'text';
    case 'numeric':
      return col.numeric_precision && col.numeric_scale
        ? `numeric(${col.numeric_precision},${col.numeric_scale})`
        : 'numeric(19,2)';
    case 'timestamp without time zone':
      return 'timestamp';
    case 'character':
      return col.character_maximum_length
        ? `char(${col.character_maximum_length})`
        : 'char(1)';
    default:
      return col.data_type;
  }
}