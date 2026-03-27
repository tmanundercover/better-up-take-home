import { MCPError } from "./MCPError";
import { runWithIdempotency } from "./idempotency";
import { withRetry } from "./withRetry";
import { writeToolAuditLog } from "./writeToolAuditLog";
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogger,
  Clients,
  ExecutionStore,
  MCPContext,
  ToolDefinition,
  ToolFailureResponse,
  ToolInput,
  ToolResponse,
  ToolResult,
  ToolSuccessResponse
} from "../types";

interface InvokeToolOptions {
  toolName: string;
  input: ToolInput;
  context: MCPContext;
}

interface MCPServerOptions {
  auditLogger: AuditLogger;
  executionStore: ExecutionStore;
  clients: Clients;
}

export class MCPServer {
  public readonly auditLogger: AuditLogger;
  public readonly executionStore: ExecutionStore;
  public readonly clients: Clients;
  private readonly tools: Record<string, ToolDefinition<any, any>> = {};

  constructor({ auditLogger, executionStore, clients }: MCPServerOptions) {
    this.auditLogger = auditLogger;
    this.executionStore = executionStore;
    this.clients = clients;
  }

  public registerTool(tool: ToolDefinition<any, any>): void {
    this.tools[tool.name] = tool;
  }

  public async invokeTool({
    toolName,
    input,
    context
  }: InvokeToolOptions): Promise<ToolResponse> {
    const tool = this.tools[toolName];

    if (!tool) {
      return this.formatErrorResponse(
        new MCPError("UNKNOWN_TOOL", `Tool ${toolName} is not registered`, 404)
      );
    }

    return this.executeTool({ toolName, tool, input, context });
  }

  public listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    return this.auditLogger.list(filters);
  }

  private async executeTool({
    toolName,
    tool,
    input,
    context
  }: {
    toolName: string;
    tool: ToolDefinition<any, any>;
    input: ToolInput;
    context: MCPContext;
  }): Promise<ToolResponse> {
    const executionId =
      context.executionId || getString(input.executionId) || "unknown";
    const employeeId = getString(input.employeeId) || "unknown";

    try {
      this.validateAuthorization(tool, context);
      this.validateSchema(tool, input);

      const { result, idempotency } = await runWithIdempotency({
        executionStore: this.executionStore,
        toolName,
        employeeId,
        input,
        execute: async () =>
          withRetry(
            () => tool.handler(input, context) as Promise<ToolResult>,
            tool.retry || {}
          )
      });

      const auditEntry = await writeToolAuditLog({
        auditLogger: this.auditLogger,
        executionId,
        employeeId,
        toolName,
        status: "success",
        actor: context.caller,
        details: result
      });

      return {
        status: "success",
        ...result,
        idempotency,
        audit: {
          timestamp: auditEntry.timestamp,
          actor: context.caller,
          authorized: true,
          validated: true
        }
      } satisfies ToolSuccessResponse;
    } catch (error) {
      await writeToolAuditLog({
        auditLogger: this.auditLogger,
        executionId,
        employeeId,
        toolName,
        status: "failure",
        actor: context.caller,
        error
      });

      return this.formatErrorResponse(error);
    }
  }

  private validateAuthorization(
    tool: ToolDefinition<any, any>,
    context: MCPContext
  ): void {
    const allowedRoles = tool.authorization?.allowedRoles || [];
    const callerRoles = context.roles || [];

    if (allowedRoles.length === 0) {
      return;
    }

    const authorized = allowedRoles.some((role) => callerRoles.includes(role));

    if (!authorized) {
      throw new MCPError(
        "UNAUTHORIZED",
        "Caller is not authorized for this tool",
        403,
        false
      );
    }
  }

  private validateSchema(
    tool: ToolDefinition<any, any>,
    input: ToolInput
  ): void {
    const requiredFields = tool.inputSchema?.required || [];

    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null) {
        throw new MCPError(
          "INVALID_INPUT",
          `Missing required field: ${field}`,
          400,
          false
        );
      }
    }
  }

  private formatErrorResponse(error: unknown): ToolFailureResponse {
    if (error instanceof MCPError) {
      return {
        status: "failure",
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          retryable: error.retryable
        }
      };
    }

    if (error instanceof Error) {
      const code = getString((error as Error & { code?: unknown }).code);
      const statusCode =
        getNumber((error as Error & { statusCode?: unknown }).statusCode) || 500;
      const retryable = Boolean(
        (error as Error & { retryable?: unknown }).retryable || false
      );

      return {
        status: "failure",
        error: {
          code: code || "MCP_TOOL_ERROR",
          message: error.message || "Unexpected MCP server error",
          statusCode,
          retryable
        }
      };
    }

    return {
      status: "failure",
      error: {
        code: "MCP_TOOL_ERROR",
        message: "Unexpected MCP server error",
        statusCode: 500,
        retryable: false
      }
    };
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
