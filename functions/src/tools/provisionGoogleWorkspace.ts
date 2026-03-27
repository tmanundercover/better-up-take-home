import type { GoogleClient, ToolDefinition } from "../types";

interface ProvisionGoogleWorkspaceInput {
  executionId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  googleGroups: string[];
  driveTemplates?: string[];
  idempotencyKey?: string;
}

interface ProvisionGoogleWorkspaceResult {
  action: "created_workspace_user" | "reused_existing_workspace_user";
  emailCreated: boolean;
  groupsApplied: string[];
}

export function provisionGoogleWorkspaceTool({
  googleClient
}: {
  googleClient: GoogleClient;
}): ToolDefinition<
  ProvisionGoogleWorkspaceInput,
  ProvisionGoogleWorkspaceResult
> {
  return {
    name: "provision_google_workspace",
    authorization: {
      allowedRoles: ["it_automation_service"]
    },
    inputSchema: {
      required: [
        "executionId",
        "employeeId",
        "email",
        "firstName",
        "lastName",
        "googleGroups"
      ]
    },
    retry: {
      retries: 3,
      baseDelayMs: 500
    },
    async handler(input) {
      const existingUser = await googleClient.findUserByEmail(input.email);

      if (existingUser) {
        await googleClient.ensureGroups({
          email: input.email,
          groups: input.googleGroups
        });

        return {
          action: "reused_existing_workspace_user",
          emailCreated: false,
          groupsApplied: input.googleGroups
        };
      }

      await googleClient.provisionUser({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        groups: input.googleGroups,
        driveTemplates: input.driveTemplates || []
      });

      return {
        action: "created_workspace_user",
        emailCreated: true,
        groupsApplied: input.googleGroups
      };
    }
  };
}
