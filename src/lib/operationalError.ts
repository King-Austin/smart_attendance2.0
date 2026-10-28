export type OperationalSeverity = "warning" | "error";

export interface OperationalErrorDetail {
  area: string;
  operation: string;
  message: string;
  severity: OperationalSeverity;
  timestamp: string;
  context?: Record<string, string | number | boolean | null>;
}

/**
 * Emit a consistent, non-sensitive diagnostic for recoverable mobile/runtime
 * failures. Consumers can listen for `scp:operational-error` to forward these
 * events to an approved telemetry provider later.
 */
export function reportOperationalError(
  area: string,
  operation: string,
  error: unknown,
  options: {
    severity?: OperationalSeverity;
    context?: Record<string, string | number | boolean | null>;
  } = {},
): OperationalErrorDetail {
  const severity = options.severity ?? "error";
  const message = error instanceof Error ? error.message : String(error);
  const detail: OperationalErrorDetail = {
    area,
    operation,
    message,
    severity,
    timestamp: new Date().toISOString(),
    context: options.context,
  };

  if (severity === "warning") {
    console.warn(`[${area}] ${operation}: ${message}`, error, options.context ?? {});
  } else {
    console.error(`[${area}] ${operation}: ${message}`, error, options.context ?? {});
  }

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("scp:operational-error", { detail }));
  }

  return detail;
}
