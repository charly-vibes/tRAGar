/**
 * tRAGar error types — extracted here so seams can import without circular deps.
 */
import type { ErrorCode } from "./types.ts";

export class TRAGarError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TRAGarError";
  }
}
