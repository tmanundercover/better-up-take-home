import type {
  AccessDecision,
  MCPContext,
  NewHire,
  ToolFailureResponse,
  ToolInput,
  ToolResponse
} from "../types";
import type { MCPServer } from "../core/MCPServer";

interface ProvisionOnboardingOptions {
  newHire: NewHire;
  accessDecision: AccessDecision;
  mcpServer: MCPServer;
  executionId: string;
}

export async function provisionOnboarding({
  newHire,
  accessDecision,
  mcpServer,
  executionId
}: ProvisionOnboardingOptions): Promise<{
  executionId: string;
  employeeId: string;
  systems: Record<string, ToolResponse>;
}> {
  const context: MCPContext = {
    executionId,
    caller: "n8n-onboarding-workflow",
    roles: ["it_automation_service"]
  };

  const responses: Record<string, ToolResponse> = {};

  responses.okta = await invokeRequiredTool({
    mcpServer,
    toolName: "create_okta_user",
    input: {
      executionId,
      employeeId: newHire.employeeId,
      email: newHire.email,
      firstName: newHire.firstName,
      lastName: newHire.lastName,
      department: newHire.department,
      role: newHire.role,
      managerEmail: newHire.managerEmail,
      oktaGroups: accessDecision.oktaGroups
    },
    context
  });

  responses.googleWorkspace = await invokeRequiredTool({
    mcpServer,
    toolName: "provision_google_workspace",
    input: {
      executionId,
      employeeId: newHire.employeeId,
      email: newHire.email,
      firstName: newHire.firstName,
      lastName: newHire.lastName,
      googleGroups: accessDecision.googleGroups,
      driveTemplates: accessDecision.driveTemplates
    },
    context
  });

  responses.slack = await invokeRequiredTool({
    mcpServer,
    toolName: "invite_slack_user",
    input: {
      executionId,
      employeeId: newHire.employeeId,
      email: newHire.email,
      displayName: newHire.displayName,
      channels: accessDecision.slackChannels
    },
    context
  });

  responses.jira = await invokeRequiredTool({
    mcpServer,
    toolName: "assign_jira_permissions",
    input: {
      executionId,
      employeeId: newHire.employeeId,
      email: newHire.email,
      projectRoles: accessDecision.jiraRoles,
      jiraGroups: accessDecision.jiraGroups
    },
    context
  });

  return {
    executionId,
    employeeId: newHire.employeeId,
    systems: responses
  };
}

async function invokeRequiredTool({
  mcpServer,
  toolName,
  input,
  context
}: {
  mcpServer: MCPServer;
  toolName: string;
  input: ToolInput;
  context: MCPContext;
}): Promise<ToolResponse> {
  const response = await mcpServer.invokeTool({
    toolName,
    input,
    context
  });

  if (response.status === "success") {
    return response;
  }

  await mcpServer.invokeTool({
    toolName: "create_freshservice_ticket",
    input: {
      executionId: context.executionId,
      employeeId: input.employeeId,
      email: input.email,
      subject: `Onboarding step failed: ${toolName}`,
      description: `${toolName} failed for ${String(input.employeeId)}: ${
        response.error.message
      }`,
      status: "open"
    },
    context
  });

  throw toProvisioningError(response);
}

function toProvisioningError(response: ToolFailureResponse): Error {
  const error = new Error(response.error.message) as Error & {
    code?: string;
    statusCode?: number;
  };

  error.code = response.error.code;
  error.statusCode = response.error.statusCode;
  return error;
}
