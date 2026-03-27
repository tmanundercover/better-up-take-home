import type { ExecutionRecord, ExecutionStore } from "../types";

export class InMemoryExecutionStore implements ExecutionStore {
  private readonly records = new Map<string, ExecutionRecord>();

  public async get(key: string): Promise<ExecutionRecord | null> {
    return this.records.get(key) || null;
  }

  public async save(record: ExecutionRecord): Promise<ExecutionRecord> {
    this.records.set(record.key, record);
    return record;
  }
}
