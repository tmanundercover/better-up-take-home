import * as logger from "firebase-functions/logger";
import type { AuditLogEntry, AuditLogFilters, AuditLogger } from "../types";

export class ConsoleAuditLogger implements AuditLogger {
  private readonly entries: AuditLogEntry[] = [];

  public async write(entry: AuditLogEntry): Promise<AuditLogEntry> {
    this.entries.push(entry);
    logger.info("AUDIT_LOG", entry);
    return entry;
  }

  public async list(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    return this.entries.filter((entry) => {
      if (filters.executionId && entry.executionId !== filters.executionId) {
        return false;
      }

      if (filters.employeeId && entry.employeeId !== filters.employeeId) {
        return false;
      }

      if (filters.toolName && entry.toolName !== filters.toolName) {
        return false;
      }

      return true;
    });
  }
}
