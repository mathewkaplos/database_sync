import express, { Express } from "express";
import { errorHandler } from "./middleware/errorHandler";
import syncRoutes from "../routes/syncRoutes";

export function createServer(): Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // Routes
  app.use("/api/sync", syncRoutes);

  // Error handler should be last
  app.use(errorHandler);

  return app;
}
