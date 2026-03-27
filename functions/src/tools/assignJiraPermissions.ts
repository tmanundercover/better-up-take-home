import { MCPError } from "../core/MCPError";
import type { JiraClient, ToolDefinition } from "../types";

interface AssignJiraPermissionsInput {
  executionId: string;
  employeeId: string;
  email: string;
  projectRoles: string[];
  jiraGroups?: string[];
  idempotencyKey?: string;
}

interface AssignJiraPermissionsResult {
  action: "assigned_roles";
  jiraAccountId: string;
  assignedRoles: string[];
}

export function assignJiraPermissionsTool({
  jiraClient
}: {
  jiraClient: JiraClient;
}): ToolDefinition<AssignJiraPermissionsInput, AssignJiraPermissionsResult> {
  return {
    name: "assign_jira_permissions",
    authorization: {
      allowedRoles: ["it_automation_service"]
    },
    inputSchema: {
      required: ["executionId", "employeeId", "email", "projectRoles"]
    },
    retry: {
      retries: 3,
      baseDelayMs: 500
    },
    async handler(input) {
      const jiraUser = await jiraClient.findUserByEmail(input.email);

      if (!jiraUser) {
        throw new MCPError("JIRA_USER_NOT_FOUND", "Jira user not found", 404);
      }

      await jiraClient.assignProjectRoles({
        accountId: jiraUser.accountId,
        projectRoles: input.projectRoles,
        jiraGroups: input.jiraGroups || []
      });

      return {
        action: "assigned_roles",
        jiraAccountId: jiraUser.accountId,
        assignedRoles: input.projectRoles
      };
    }
  };
}
