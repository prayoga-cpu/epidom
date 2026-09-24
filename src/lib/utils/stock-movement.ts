import { MovementType } from "@prisma/client";

/**
 * A movement's quantity with the sign it should display with. PRODUCTION_OUT
 * rows are stored positive (the production service's convention), yet they
 * take stock out, so they read as a reduction. Every other type is stored
 * signed already: negative takes stock out, positive puts it in.
 */
export function signedMovementQuantity(movement: {
  type: MovementType | string;
  quantity: number | string;
}): number {
  const quantity = Number(movement.quantity);
  return movement.type === MovementType.PRODUCTION_OUT ? -Math.abs(quantity) : quantity;
}
