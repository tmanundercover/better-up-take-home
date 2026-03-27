import type { RetryOptions } from "../types";

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 500,
    shouldRetry = defaultShouldRetry
  } = options;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      await sleep(baseDelayMs * Math.pow(2, attempt));
      attempt += 1;
    }
  }

  throw new Error("Retry loop exited unexpectedly");
}

function defaultShouldRetry(error: unknown): boolean {
  if (isRetryableError(error)) {
    return error.retryable;
  }

  if (hasStatusCode(error)) {
    return [429, 500, 502, 503, 504].includes(error.statusCode);
  }

  return false;
}

function hasStatusCode(
  error: unknown
): error is {
  statusCode: number;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

function isRetryableError(
  error: unknown
): error is {
  retryable: boolean;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { retryable?: unknown }).retryable === "boolean"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
