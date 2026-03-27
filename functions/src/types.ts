export interface BaseRequestInput {
  executionId: string;
  employeeId: string;
  idempotencyKey?: string;
}

export type ToolInput = Record<string, unknown>;
export type ToolResult = Record<string, unknown>;

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface MCPContext {
  executionId: string;
  caller: string;
  roles: string[];
}

export interface IdempotencyResult {
  key: string;
  reused: boolean;
}

export interface AuditMetadata {
  timestamp: string;
  actor: string;
  authorized: boolean;
  validated: boolean;
}

export interface ErrorPayload {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}

export type ToolSuccessResponse<TResult extends ToolResult = ToolResult> = TResult & {
  status: "success";
  idempotency: IdempotencyResult;
  audit: AuditMetadata;
};

export interface ToolFailureResponse {
  status: "failure";
  error: ErrorPayload;
}

export type ToolResponse<TResult extends ToolResult = ToolResult> =
  | ToolSuccessResponse<TResult>
  | ToolFailureResponse;

export interface AuditLogEntry {
  executionId: string;
  employeeId: string;
  layer: "mcp-server" | "workflow";
  toolName: string;
  status: "success" | "failure";
  actor: string;
  details: Record<string, unknown>;
  error: {
    code: string;
    message: string;
    statusCode: number | null;
  } | null;
  timestamp: string;
}

export interface AuditLogFilters {
  executionId?: string;
  employeeId?: string;
  toolName?: string;
}

export interface AuditLogIngestRequest {
  executionId: string;
  employeeId: string;
  email: string;
  status: "success" | "failure";
  checks?: Record<string, boolean>;
  systems: string[];
  timestamp?: string;
  actor?: string;
}

export interface AuditLogger {
  write(entry: AuditLogEntry): Promise<AuditLogEntry>;
  list(filters?: AuditLogFilters): Promise<AuditLogEntry[]>;
}

export interface ExecutionRecord<TResult extends ToolResult = ToolResult> {
  key: string;
  employeeId: string;
  toolName: string;
  status: "success";
  result: TResult;
  timestamp: string;
}

export interface ExecutionStore {
  get(key: string): Promise<ExecutionRecord | null>;
  save(record: ExecutionRecord): Promise<ExecutionRecord>;
}

export interface ToolAuthorization {
  allowedRoles: string[];
}

export interface ToolInputSchema {
  required: string[];
}

export interface ToolDefinition<
  TInput extends object = ToolInput,
  TResult extends object = ToolResult
> {
  name: string;
  authorization?: ToolAuthorization;
  inputSchema?: ToolInputSchema;
  retry?: RetryOptions;
  handler(input: TInput, context: MCPContext): Promise<TResult>;
}

export interface OktaUserRecord {
  id: string;
}

export interface SlackUserRecord {
  id: string;
}

export interface JiraUserRecord {
  accountId: string;
}

export interface TicketRecord {
  id: string;
}

export interface OktaClient {
  findUserByEmail(email: string): Promise<OktaUserRecord | null>;
  ensureGroups(input: { userId: string; groups: string[] }): Promise<void>;
  createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    department: string;
    role: string;
    managerEmail?: string;
    groups: string[];
  }): Promise<OktaUserRecord>;
}

export interface GoogleClient {
  findUserByEmail(email: string): Promise<{ email: string } | null>;
  ensureGroups(input: { email: string; groups: string[] }): Promise<void>;
  provisionUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    groups: string[];
    driveTemplates: string[];
  }): Promise<void>;
}

export interface SlackClient {
  findUserByEmail(email: string): Promise<SlackUserRecord | null>;
  ensureChannels(input: { userId: string; channels: string[] }): Promise<void>;
  inviteUser(input: {
    email: string;
    displayName?: string;
    channels: string[];
  }): Promise<SlackUserRecord>;
}

export interface JiraClient {
  findUserByEmail(email: string): Promise<JiraUserRecord | null>;
  assignProjectRoles(input: {
    accountId: string;
    projectRoles: string[];
    jiraGroups: string[];
  }): Promise<void>;
}

export interface FreshserviceClient {
  findOpenTicketByEmployeeId(employeeId: string): Promise<TicketRecord | null>;
  updateTicket(input: {
    ticketId: string;
    status: string;
    description: string;
  }): Promise<void>;
  createTicket(input: {
    employeeId: string;
    email: string;
    subject: string;
    description: string;
    status: string;
  }): Promise<TicketRecord>;
}

export interface Clients {
  okta: OktaClient;
  google: GoogleClient;
  slack: SlackClient;
  jira: JiraClient;
  freshservice: FreshserviceClient;
}

export interface NewHire {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  department: string;
  role: string;
  managerEmail?: string;
}

export interface AccessDecision {
  oktaGroups: string[];
  googleGroups: string[];
  driveTemplates?: string[];
  slackChannels: string[];
  jiraRoles: string[];
  jiraGroups?: string[];
}
