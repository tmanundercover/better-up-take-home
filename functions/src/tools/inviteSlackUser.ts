import type { SlackClient, ToolDefinition } from "../types";

interface InviteSlackUserInput {
  executionId: string;
  employeeId: string;
  email: string;
  displayName?: string;
  channels: string[];
  idempotencyKey?: string;
}

interface InviteSlackUserResult {
  action: "invited_user" | "reused_existing_user";
  slackUserId: string;
  channelsAssigned: string[];
}

export function inviteSlackUserTool({
  slackClient
}: {
  slackClient: SlackClient;
}): ToolDefinition<InviteSlackUserInput, InviteSlackUserResult> {
  return {
    name: "invite_slack_user",
    authorization: {
      allowedRoles: ["it_automation_service"]
    },
    inputSchema: {
      required: ["executionId", "employeeId", "email", "channels"]
    },
    retry: {
      retries: 3,
      baseDelayMs: 500
    },
    async handler(input) {
      const existingUser = await slackClient.findUserByEmail(input.email);

      if (existingUser) {
        await slackClient.ensureChannels({
          userId: existingUser.id,
          channels: input.channels
        });

        return {
          action: "reused_existing_user",
          slackUserId: existingUser.id,
          channelsAssigned: input.channels
        };
      }

      const invitedUser = await slackClient.inviteUser({
        email: input.email,
        displayName: input.displayName,
        channels: input.channels
      });

      return {
        action: "invited_user",
        slackUserId: invitedUser.id,
        channelsAssigned: input.channels
      };
    }
  };
}
