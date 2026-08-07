/**
 * Shared channel/event naming for the Pusher-based live-update layer.
 * Safe to import from both server and client code — no secrets here.
 *
 * One private channel per store carries every domain event (order, material,
 * product, recipe, stock, menu) rather than one channel per domain — Pusher
 * bills/limits by concurrent channel subscriptions per connection, and a
 * single POS terminal or dashboard tab realistically wants all of them at
 * once. Presence (who's connected) is a separate channel since it has
 * different semantics (member list, join/leave) from data-change events.
 */

export function storeDataChannel(storeId: string): string {
  return `private-store-${storeId}`;
}

export function storePresenceChannel(storeId: string): string {
  return `presence-store-${storeId}`;
}

/**
 * Event names published on a store's data channel. Payloads are
 * intentionally minimal (id + action) — clients treat a push as "go
 * refetch," not as the full authoritative record, so the payload shape never
 * has to match each domain's serialization exactly.
 */
export const REALTIME_EVENTS = {
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
  MENU_CHANGED: "menu.changed",
  MATERIAL_CHANGED: "material.changed",
  PRODUCT_CHANGED: "product.changed",
  RECIPE_CHANGED: "recipe.changed",
  STOCK_CHANGED: "stock.changed",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type EntityChangeAction = "created" | "updated" | "deleted";

export interface EntityChangePayload {
  action: EntityChangeAction;
  entityId: string;
}
