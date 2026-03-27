import { assignJiraPermissionsTool } from "./assignJiraPermissions";
import { createFreshserviceTicketTool } from "./createFreshserviceTicket";
import { createOktaUserTool } from "./createOktaUser";
import { inviteSlackUserTool } from "./inviteSlackUser";
import { provisionGoogleWorkspaceTool } from "./provisionGoogleWorkspace";
import type { Clients } from "../types";
import type { MCPServer } from "../core/MCPServer";

export function registerTools(server: MCPServer, clients: Clients): void {
  server.registerTool(createOktaUserTool({ oktaClient: clients.okta }));
  server.registerTool(
    provisionGoogleWorkspaceTool({ googleClient: clients.google })
  );
  server.registerTool(inviteSlackUserTool({ slackClient: clients.slack }));
  server.registerTool(assignJiraPermissionsTool({ jiraClient: clients.jira }));
  server.registerTool(
    createFreshserviceTicketTool({ freshserviceClient: clients.freshservice })
  );
}
