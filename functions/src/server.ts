import { MCPServer } from "./core/MCPServer";
import { ConsoleAuditLogger } from "./infrastructure/ConsoleAuditLogger";
import { InMemoryExecutionStore } from "./infrastructure/InMemoryExecutionStore";
import { createExampleClients } from "./clients";
import { registerTools } from "./tools";
import type { AuditLogger, Clients, ExecutionStore } from "./types";

interface CreateMCPServerOptions {
  clients?: Clients;
  auditLogger?: AuditLogger;
  executionStore?: ExecutionStore;
}

export function createMCPServer({
  clients = createExampleClients(),
  auditLogger = new ConsoleAuditLogger(),
  executionStore = new InMemoryExecutionStore()
}: CreateMCPServerOptions = {}): MCPServer {
  const server = new MCPServer({
    clients,
    auditLogger,
    executionStore
  });

  registerTools(server, clients);
  return server;
}
