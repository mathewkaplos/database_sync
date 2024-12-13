import express from "express";
import SyncController from "../controllers/syncController";

const router = express.Router();
const syncController = new SyncController();

// New routes
router.post("/table/:tableName", (req, res) =>
  syncController.syncTable(req, res)
);
router.post("/all", (req, res) => syncController.syncAllTables(req, res));

router.post("/manual", (req, res) => syncController.manualSync(req, res));
router.post("/manual-one/:table", (req, res) =>
  syncController.manualSyncOne(req, res)
);
router.post("/cleanup/:tableName", (req, res) =>
  syncController.cleanupTable(req, res)
);
router.get("/compare/:tableName", (req, res) =>
  syncController.compareData(req, res)
);
router.get("/data/:tableName", (req, res) =>
  syncController.showTableData(req, res)
);
router.post("/check-metadata", (req, res) =>
  syncController.checkMetadata(req, res)
);
router.get("/check-table", (req, res) =>
  syncController.checkTableExists(req, res)
);

export default router;
