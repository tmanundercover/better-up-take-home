import type { AuditLogEntry, AuditLogger } from "../types";

interface WriteAuditLogOptions {
  auditLogger: AuditLogger;
  executionId: string;
  employeeId: string;
  toolName: string;
  status: "success" | "failure";
  actor: string;
  details?: Record<string, unknown>;
  error?: unknown;
}

export async function writeToolAuditLog({
  auditLogger,
  executionId,
  employeeId,
  toolName,
  status,
  actor,
  details = {},
  error = null
}: WriteAuditLogOptions): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    executionId,
    employeeId,
    layer: "mcp-server",
    toolName,
    status,
    actor,
    details,
    error: formatError(error),
    timestamp: new Date().toISOString()
  };

  await auditLogger.write(entry);
  return entry;
}

function formatError(error: unknown): AuditLogEntry["error"] {
  if (!(error instanceof Error)) {
    return null;
  }

  return {
    code: getErrorCode(error),
    message: error.message,
    statusCode: getStatusCode(error)
  };
}

function getErrorCode(error: Error): string {
  const withCode = error as Error & { code?: unknown };
  return typeof withCode.code === "string" ? withCode.code : "UNKNOWN_ERROR";
}

function getStatusCode(error: Error): number | null {
  const withStatus = error as Error & { statusCode?: unknown };
  return typeof withStatus.statusCode === "number" ? withStatus.statusCode : null;
}
