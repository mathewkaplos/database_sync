import winston from "winston";
import path from "path";

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom timestamp format for East African Time (UTC+3)
const timestampFormat = (): string => {
  const date = new Date();
  date.setHours(date.getHours() + 3);
  return date.toISOString().replace("T", " ").replace("Z", "").concat(" EAT");
};

const maskSensitiveData = winston.format((info) => {
  if (info.message && typeof info.message === "string") {
    // Mask sensitive patterns
    info.message = info.message.replace(
      /(password|credential)s?["\s]*:["\s]*[^\s,}"]+/gi,
      "$1: [MASKED]"
    );
  }
  return info;
});

const logger = winston.createLogger({
  levels,
  format: winston.format.combine(
    maskSensitiveData(),
    winston.format.timestamp({ format: timestampFormat }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "postgres-sync" },
  transports: [
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join("logs", "sync.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export default logger;
