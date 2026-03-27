import type { FreshserviceClient, ToolDefinition } from "../types";

interface CreateFreshserviceTicketInput {
  executionId: string;
  employeeId: string;
  email: string;
  subject: string;
  description: string;
  status: string;
  idempotencyKey?: string;
}

interface CreateFreshserviceTicketResult {
  action: "created_ticket" | "updated_ticket";
  ticketId: string;
}

export function createFreshserviceTicketTool({
  freshserviceClient
}: {
  freshserviceClient: FreshserviceClient;
}): ToolDefinition<
  CreateFreshserviceTicketInput,
  CreateFreshserviceTicketResult
> {
  return {
    name: "create_freshservice_ticket",
    authorization: {
      allowedRoles: ["it_automation_service"]
    },
    inputSchema: {
      required: [
        "executionId",
        "employeeId",
        "email",
        "subject",
        "description",
        "status"
      ]
    },
    retry: {
      retries: 2,
      baseDelayMs: 500
    },
    async handler(input) {
      const existingTicket = await freshserviceClient.findOpenTicketByEmployeeId(
        input.employeeId
      );

      if (existingTicket) {
        await freshserviceClient.updateTicket({
          ticketId: existingTicket.id,
          status: input.status,
          description: input.description
        });

        return {
          action: "updated_ticket",
          ticketId: existingTicket.id
        };
      }

      const createdTicket = await freshserviceClient.createTicket({
        employeeId: input.employeeId,
        email: input.email,
        subject: input.subject,
        description: input.description,
        status: input.status
      });

      return {
        action: "created_ticket",
        ticketId: createdTicket.id
      };
    }
  };
}
