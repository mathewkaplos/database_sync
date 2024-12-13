import { Request, Response, NextFunction } from "express";
import { SyncError, DatabaseError } from "../../types/errors";
import logger from "../../utils/logger";

interface ErrorResponse {
  error: string;
  details?: string;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`Error: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);

  const response: ErrorResponse = {
    error: "Internal Server Error",
  };

  if (err instanceof SyncError || err instanceof DatabaseError) {
    response.details = err.message;
    if (process.env.NODE_ENV === "development") {
      response.stack = err.stack;
    }
  }

  res.status(500).json(response);
};
