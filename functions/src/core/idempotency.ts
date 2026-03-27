import type {
  ExecutionStore,
  IdempotencyResult,
  ToolInput,
  ToolResult
} from "../types";

interface IdempotencyOptions<TResult extends ToolResult> {
  executionStore: ExecutionStore;
  toolName: string;
  employeeId: string;
  input: ToolInput;
  execute: () => Promise<TResult>;
}

interface IdempotentExecution<TResult extends ToolResult> {
  result: TResult;
  idempotency: IdempotencyResult;
}

export async function runWithIdempotency<TResult extends ToolResult>({
  executionStore,
  toolName,
  employeeId,
  input,
  execute
}: IdempotencyOptions<TResult>): Promise<IdempotentExecution<TResult>> {
  const key = buildIdempotencyKey({
    employeeId,
    toolName,
    input
  });

  const existing = await executionStore.get(key);

  if (existing?.status === "success") {
    return {
      result: existing.result as TResult,
      idempotency: {
        key,
        reused: true
      }
    };
  }

  const result = await execute();

  await executionStore.save({
    key,
    employeeId,
    toolName,
    status: "success",
    result,
    timestamp: new Date().toISOString()
  });

  return {
    result,
    idempotency: {
      key,
      reused: false
    }
  };
}

function buildIdempotencyKey({
  employeeId,
  toolName,
  input
}: {
  employeeId: string;
  toolName: string;
  input: ToolInput;
}): string {
  if (typeof input.idempotencyKey === "string" && input.idempotencyKey.length > 0) {
    return input.idempotencyKey;
  }

  const normalizedInput = omitRequestMetadata(input);
  return `${employeeId}:${toolName}:${stableStringify(normalizedInput)}`;
}

function omitRequestMetadata(input: ToolInput): ToolInput {
  const clone: ToolInput = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === "executionId" || key === "idempotencyKey") {
      continue;
    }

    clone[key] = value;
  }

  return clone;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map(
      (key) =>
        `"${key}":${stableStringify((value as Record<string, unknown>)[key])}`
    );
    return `{${pairs.join(",")}}`;
  }

  return JSON.stringify(value);
}
