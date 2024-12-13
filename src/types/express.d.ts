declare namespace Express {
  interface Error {
    status?: number;
    details?: string;
  }
}
