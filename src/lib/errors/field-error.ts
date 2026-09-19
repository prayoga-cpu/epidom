import { AppError } from "./index";
import { ApiErrorCode } from "@/types/api/responses";

/**
 * An error the client can pin to ONE form field.
 *
 * handleApiError forwards `AppError.details` untouched, and the Back Office
 * dialogs run every failed mutation through `applyServerFieldErrors`
 * (src/lib/utils/form-server-errors.ts), which reads a `{ field, message }[]`
 * array — the exact shape a ZodError already produces. Emitting that shape for
 * business-rule failures too (a duplicate phone, a taken barcode) puts the
 * message under the offending input instead of in a generic toast.
 */
export class FieldError extends AppError {
  constructor(
    field: string,
    message: string,
    code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR,
    statusCode = 400
  ) {
    // AppError types `details` as a Record, but the wire (and the client
    // helper) want an array of field errors — an array IS a valid object, so
    // the cast is the honest description of what is sent.
    super(message, code, statusCode, [{ field, message }] as unknown as Record<string, unknown>);
  }
}

/** A uniqueness collision on `field` — HTTP 409 CONFLICT. */
export class FieldConflictError extends FieldError {
  constructor(field: string, message: string) {
    super(field, message, ApiErrorCode.CONFLICT, 409);
  }
}
