export class MCPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    retryable = false
  ) {
    super(message);
    this.name = "MCPError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
