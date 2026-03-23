/**
 * Structured logger for the application.
 *
 * Uses log levels controlled by the LOG_LEVEL env var (default: "info").
 * In development, output is colorized and formatted for readability.
 * In production, output is structured JSON for log aggregation.
 *
 * Levels: debug < info < warn < error
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function getMinLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (env in LEVEL_PRIORITY) return env as LogLevel;
  return "info";
}

const isDev = process.env.NODE_ENV !== "production";

interface LogContext {
  [key: string]: unknown;
}

function formatDevMessage(
  level: LogLevel,
  scope: string,
  message: string,
  ctx?: LogContext,
): string {
  const color = LEVEL_COLORS[level];
  const time = new Date().toLocaleTimeString("de-DE", { hour12: false });
  const levelTag = level.toUpperCase().padEnd(5);

  let line = `${DIM}${time}${RESET} ${color}${levelTag}${RESET} ${BOLD}[${scope}]${RESET} ${message}`;

  if (ctx && Object.keys(ctx).length > 0) {
    const entries = Object.entries(ctx);
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      const formatted =
        typeof value === "string" && value.length > 300
          ? `\n${DIM}──── ${key} ────${RESET}\n${value}\n${DIM}────${"─".repeat(key.length + 2)}────${RESET}`
          : typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value);

      if (formatted.includes("\n")) {
        line += `\n  ${DIM}${key}:${RESET} ${formatted}`;
      } else {
        line += `  ${DIM}${key}=${RESET}${formatted}`;
      }
    }
  }

  return line;
}

function formatProdMessage(
  level: LogLevel,
  scope: string,
  message: string,
  ctx?: LogContext,
): string {
  return JSON.stringify({
    level,
    scope,
    message,
    ...ctx,
    timestamp: new Date().toISOString(),
  });
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function log(
  level: LogLevel,
  scope: string,
  message: string,
  ctx?: LogContext,
) {
  if (!shouldLog(level)) return;

  const output = isDev
    ? formatDevMessage(level, scope, message, ctx)
    : formatProdMessage(level, scope, message, ctx);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export interface Logger {
  debug(message: string, ctx?: LogContext): void;
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
  child(subScope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, ctx) => log("debug", scope, msg, ctx),
    info: (msg, ctx) => log("info", scope, msg, ctx),
    warn: (msg, ctx) => log("warn", scope, msg, ctx),
    error: (msg, ctx) => log("error", scope, msg, ctx),
    child: (subScope) => createLogger(`${scope}:${subScope}`),
  };
}
