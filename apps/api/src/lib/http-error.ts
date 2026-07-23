export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "HTTP_ERROR",
    public details?: unknown
  ) {
    super(message);
  }
}

export function assertFound<T>(value: T | undefined | null, message = "Not found"): T {
  if (!value) {
    throw new HttpError(404, message, "NOT_FOUND");
  }
  return value;
}
