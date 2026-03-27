import type { Request, Response } from "express";
import { onRequest } from "firebase-functions/v2/https";
import { MCPError } from "./core/MCPError";
import { createMCPServer } from "./server";
import { provisionOnboarding } from "./workflows/provisionOnboarding";
import type {
  AccessDecision,
  AuditLogEntry,
  AuditLogIngestRequest,
  MCPContext,
  NewHire,
  ToolFailureResponse,
  ToolInput,
  ToolResponse
} from "./types";

const mcpServer = createMCPServer();
const allowedOrigins = new Set([
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5678",
  "http://127.0.0.1:5678"
]);

export const mcpApi = onRequest(
  { cors: false },
  async (request: Request, response: Response) => {
    applyCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    const path = normalizePath(request.path);

    if (request.method === "GET" && path === "/health") {
      response.status(200).json({
        status: "ok",
        version: "1.0.0"
      });
      return;
    }

    if (request.method === "GET" && path === "/audit/tool-invocations") {
      const items = await mcpServer.listAuditLogs({
        executionId: getQueryValue(request, "executionId"),
        employeeId: getQueryValue(request, "employeeId"),
        toolName: getQueryValue(request, "toolName")
      });

      response.status(200).json({ items });
      return;
    }

    if (request.method === "POST" && path === "/audit/logs") {
      try {
        const entry = buildPostedAuditLog(request, getRequestBody(request));
        const savedEntry = await mcpServer.auditLogger.write(entry);

        response.status(201).json({
          status: "success",
          item: savedEntry
        });
      } catch (error) {
        const failure = formatFailure(error);
        response.status(failure.error.statusCode).json(failure);
      }

      return;
    }

    if (request.method === "POST" && path.startsWith("/tools/")) {
      const toolName = decodeURIComponent(path.replace("/tools/", ""));
      const input = getRequestBody(request);
      const context = buildContext(request, input);
      const result = await mcpServer.invokeTool({ toolName, input, context });

      respondWithToolResult(response, result);
      return;
    }

    if (
      request.method === "POST" &&
      path === "/workflows/provision_onboarding"
    ) {
      const input = getRequestBody(request);
      const executionId = getString(input.executionId) || generateExecutionId();

      try {
        const result = await provisionOnboarding({
          executionId,
          newHire: input.newHire as NewHire,
          accessDecision: input.accessDecision as AccessDecision,
          mcpServer
        });

        response.status(200).json({
          status: "success",
          ...result
        });
      } catch (error) {
        const failure = formatFailure(error);
        response.status(failure.error.statusCode).json(failure);
      }

      return;
    }

    response.status(404).json({
      status: "failure",
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${path} is not implemented`,
        statusCode: 404,
        retryable: false
      }
    });
  }
);

function applyCorsHeaders(request: Request, response: Response): void {
  const origin = request.header("origin");

  if (origin && isAllowedOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, x-caller, x-caller-roles, x-execution-id"
  );
}

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" && url.hostname.endsWith(".use.devtunnels.ms")
    );
  } catch {
    return false;
  }
}

function buildContext(request: Request, input: ToolInput): MCPContext {
  const rolesHeader = request.header("x-caller-roles") || "";

  return {
    executionId:
      getString(input.executionId) ||
      request.header("x-execution-id") ||
      generateExecutionId(),
    caller: request.header("x-caller") || "anonymous-caller",
    roles: rolesHeader
      .split(",")
      .map((role: string) => role.trim())
      .filter(Boolean)
  };
}

function buildPostedAuditLog(
  request: Request,
  input: ToolInput
): AuditLogEntry {
  const payload = input as Partial<AuditLogIngestRequest>;

  if (!isNonEmptyString(payload.executionId)) {
    throw new MCPError("INVALID_INPUT", "Missing required field: executionId", 400);
  }

  if (!isNonEmptyString(payload.employeeId)) {
    throw new MCPError("INVALID_INPUT", "Missing required field: employeeId", 400);
  }

  if (!isNonEmptyString(payload.email)) {
    throw new MCPError("INVALID_INPUT", "Missing required field: email", 400);
  }

  if (!isAuditStatus(payload.status)) {
    throw new MCPError("INVALID_INPUT", "Missing required field: status", 400);
  }

  if (!Array.isArray(payload.systems)) {
    throw new MCPError("INVALID_INPUT", "Missing required field: systems", 400);
  }

  return {
    executionId: payload.executionId,
    employeeId: payload.employeeId,
    layer: "workflow",
    toolName: "workflow_summary",
    status: payload.status,
    actor:
      (isNonEmptyString(payload.actor) && payload.actor) ||
      request.header("x-caller") ||
      "n8n",
    details: {
      email: payload.email,
      checks: isObject(payload.checks) ? payload.checks : {},
      systems: payload.systems
    },
    error: null,
    timestamp:
      (isNonEmptyString(payload.timestamp) && payload.timestamp) ||
      new Date().toISOString()
  };
}

function respondWithToolResult(response: Response, result: ToolResponse): void {
  if (result.status === "success") {
    response.status(200).json(result);
    return;
  }

  response.status(result.error.statusCode).json(result);
}

function getRequestBody(request: Request): ToolInput {
  if (isObject(request.body)) {
    return request.body as ToolInput;
  }

  return {};
}

function getQueryValue(request: Request, key: string): string | undefined {
  const value = request.query[key];
  return typeof value === "string" ? value : undefined;
}

function normalizePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function formatFailure(error: unknown): ToolFailureResponse {
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
    return {
      status: "failure",
      error: {
        code: getString((error as Error & { code?: unknown }).code) || "MCP_ERROR",
        message: error.message,
        statusCode:
          getNumber((error as Error & { statusCode?: unknown }).statusCode) || 500,
        retryable: false
      }
    };
  }

  return {
    status: "failure",
    error: {
      code: "MCP_ERROR",
      message: "Unexpected error",
      statusCode: 500,
      retryable: false
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAuditStatus(value: unknown): value is "success" | "failure" {
  return value === "success" || value === "failure";
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function generateExecutionId(): string {
  return `exec_${Date.now()}`;
}
