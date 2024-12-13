import { SyncConfig } from "../types";

const syncConfig: SyncConfig = {
  batchSize: 1000,
  tables: [
    {
      name: "customer_withdrawal",
      sourceName: "customer_withdrawal",
      sourceSchema: "public",
      targetSchema: "public",
      primaryKey: ["document_no", "s_sharetype_id"],
      batchSize: process.env.SYNC_BATCH_SIZE
        ? parseInt(process.env.SYNC_BATCH_SIZE)
        : 500,
      changeDetection: {
        timestampColumn: "updated_at",
        trackDeletes: true,
      },
    },
    {
      name: "m_product",
      sourceName: "m_product",
      sourceSchema: "adempiere",
      targetSchema: "adempiere",
      primaryKey: ["m_product_id"],
      batchSize: process.env.SYNC_BATCH_SIZE
        ? parseInt(process.env.SYNC_BATCH_SIZE)
        : 500,
      changeDetection: {
        timestampColumn: "updated",
        trackDeletes: true,
      },
    },
  ],
  retryAttempts: 3,
  retryDelay: 5000,
};

export default syncConfig;
