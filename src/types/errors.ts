export class SyncError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SyncError";
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
  }
}
