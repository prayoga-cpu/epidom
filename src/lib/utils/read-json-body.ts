import { ValidationError } from "@/lib/errors";

/**
 * Parse a request's JSON body, answering a malformed one with a 400.
 *
 * A bare `await request.json()` throws a SyntaxError that handleApiError does
 * not recognise, so a truncated body would surface as a 500 "unexpected error"
 * — wrong for something the CLIENT got wrong, and noise in the error log.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
