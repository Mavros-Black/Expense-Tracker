type LogContext = Record<string, unknown> | undefined;

export function logParseError(source: string, message: string, context?: LogContext) {
  // Simple logging hook; can be wired to Sentry using SENTRY_DSN later.
  // For now, log to stderr so failures are visible in logs.
  // eslint-disable-next-line no-console
  console.error(`[ParseError][${source}] ${message}`, context);
}
