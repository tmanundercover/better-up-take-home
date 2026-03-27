import type { ToolDefinition } from "../types";
import type { OktaClient } from "../types";

interface CreateOktaUserInput {
  executionId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  managerEmail?: string;
  oktaGroups: string[];
  idempotencyKey?: string;
}

interface CreateOktaUserResult {
  action: "created_user" | "reused_existing_user";
  oktaUserId: string;
}

export function createOktaUserTool({
  oktaClient
}: {
  oktaClient: OktaClient;
}): ToolDefinition<CreateOktaUserInput, CreateOktaUserResult> {
  return {
    name: "create_okta_user",
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
        "department",
        "role",
        "oktaGroups"
      ]
    },
    retry: {
      retries: 3,
      baseDelayMs: 500
    },
    async handler(input) {
      const existingUser = await oktaClient.findUserByEmail(input.email);

      if (existingUser) {
        await oktaClient.ensureGroups({
          userId: existingUser.id,
          groups: input.oktaGroups
        });

        return {
          action: "reused_existing_user",
          oktaUserId: existingUser.id
        };
      }

      const createdUser = await oktaClient.createUser({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        department: input.department,
        role: input.role,
        managerEmail: input.managerEmail,
        groups: input.oktaGroups
      });

      return {
        action: "created_user",
        oktaUserId: createdUser.id
      };
    }
  };
}
