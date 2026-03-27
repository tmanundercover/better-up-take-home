import type {
  Clients,
  FreshserviceClient,
  GoogleClient,
  JiraClient,
  JiraUserRecord,
  OktaClient,
  OktaUserRecord,
  SlackClient,
  SlackUserRecord,
  TicketRecord
} from "./types";

export function createExampleClients(): Clients {
  const oktaUsers = new Map<string, OktaUserRecord>();
  const googleUsers = new Set<string>();
  const slackUsers = new Map<string, SlackUserRecord>();
  const tickets = new Map<string, TicketRecord>();

  const okta: OktaClient = {
    async findUserByEmail(email) {
      return oktaUsers.get(email) || null;
    },
    async ensureGroups() {
      return undefined;
    },
    async createUser(input) {
      const user = {
        id: createStableId("okta", input.email)
      };
      oktaUsers.set(input.email, user);
      return user;
    }
  };

  const google: GoogleClient = {
    async findUserByEmail(email) {
      return googleUsers.has(email) ? { email } : null;
    },
    async ensureGroups() {
      return undefined;
    },
    async provisionUser(input) {
      googleUsers.add(input.email);
    }
  };

  const slack: SlackClient = {
    async findUserByEmail(email) {
      return slackUsers.get(email) || null;
    },
    async ensureChannels() {
      return undefined;
    },
    async inviteUser(input) {
      const user = {
        id: createStableId("slack", input.email)
      };
      slackUsers.set(input.email, user);
      return user;
    }
  };

  const jira: JiraClient = {
    async findUserByEmail(email) {
      if (!email) {
        return null;
      }

      const user: JiraUserRecord = {
        accountId: createStableId("jira", email)
      };
      return user;
    },
    async assignProjectRoles() {
      return undefined;
    }
  };

  const freshservice: FreshserviceClient = {
    async findOpenTicketByEmployeeId(employeeId) {
      return tickets.get(employeeId) || null;
    },
    async updateTicket() {
      return undefined;
    },
    async createTicket(input) {
      const ticket = {
        id: createStableId("ticket", `${input.email}:${input.subject}`)
      };
      tickets.set(input.employeeId, ticket);
      return ticket;
    }
  };

  return {
    okta,
    google,
    slack,
    jira,
    freshservice
  };
}

function createStableId(prefix: string, value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${prefix}_${normalized.slice(0, 12) || "generated"}`;
}
