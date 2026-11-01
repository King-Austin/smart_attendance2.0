export function reportOperationalError(
  area: string,
  operation: string,
  _error: unknown,
  options: {
    severity?: "warning" | "error";
    context?: Record<string, string | number | boolean | null>;
  } = {},
) {
  // Do not serialize provider errors: they may contain biometric or personal data.
  if (__DEV__) console.warn(`[${area}] ${operation}`, { severity: options.severity ?? "error" });
}
